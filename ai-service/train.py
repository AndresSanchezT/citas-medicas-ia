"""
Entrena los dos modelos del servicio de IA a partir del historico real
de la base de datos:

1. Regresion (RandomForestRegressor): tiempo de espera estimado, a partir
   de wait_time_history (una fila por cada cita completada).
2. Clasificacion (RandomForestClassifier): riesgo de inasistencia (no-show),
   a partir de appointments (COMPLETADA vs NO_ASISTIO).

Guarda ambos modelos en app/models/*.joblib. El servicio FastAPI los carga
en el arranque; si no existen, cae en la heuristica de respaldo (ver
app/prediction.py).
"""

import os
from urllib.parse import urlparse

import joblib
import mysql.connector
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    precision_score,
    recall_score,
    root_mean_squared_error,
)
from sklearn.model_selection import train_test_split

load_dotenv()

MODELS_DIR = os.path.join(os.path.dirname(__file__), "app", "models")
os.makedirs(MODELS_DIR, exist_ok=True)
WAIT_TIME_MODEL_PATH = os.path.join(MODELS_DIR, "wait_time_regressor.joblib")
NO_SHOW_MODEL_PATH = os.path.join(MODELS_DIR, "no_show_classifier.joblib")

MIN_REGISTROS_REGRESION = 30
MIN_REGISTROS_CLASIFICACION = 30


def get_connection():
    url = urlparse(os.environ["DATABASE_URL"])
    return mysql.connector.connect(
        host=url.hostname,
        port=url.port or 3306,
        user=url.username,
        password=url.password,
        database=url.path.lstrip("/"),
    )


def franja_to_hour(franja: str) -> int:
    # franja_horaria tiene formato "08:00-09:00"
    return int(franja.split("-")[0].split(":")[0])


def python_weekday_to_dia_semana(fecha) -> int:
    # date.weekday(): 0=lunes..6=domingo. Convencion del proyecto: 0=domingo..6=sabado
    # (igual que JS Date.getDay()), usada en dia_semana de wait_time_history/appointments.
    return (fecha.weekday() + 1) % 7


def entrenar_wait_time(conn) -> None:
    print("\n=== Entrenando modelo de regresion: tiempo de espera ===")
    query = """
        SELECT wth.doctor_id, d.specialty_id, wth.dia_semana, wth.franja_horaria,
               wth.tiempo_espera_minutos_real
        FROM wait_time_history wth
        JOIN doctors d ON d.id = wth.doctor_id
    """
    df = pd.read_sql(query, conn)
    print(f"Registros de historico disponibles: {len(df)}")

    if len(df) < MIN_REGISTROS_REGRESION:
        print(f"Insuficiente historico (< {MIN_REGISTROS_REGRESION}); no se entrena el modelo. "
              "El servicio seguira usando la heuristica de respaldo.")
        return

    df["hora"] = df["franja_horaria"].apply(franja_to_hour)
    X = df[["doctor_id", "specialty_id", "dia_semana", "hora"]]
    y = df["tiempo_espera_minutos_real"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    modelo = RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42)
    modelo.fit(X_train, y_train)

    y_pred = modelo.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    print(f"MAE (conjunto de prueba, {len(X_test)} registros): {mae:.2f} minutos")
    print(f"RMSE (conjunto de prueba): {rmse:.2f} minutos")

    # Se reentrena con el 100% de los datos para el modelo final que queda en produccion.
    modelo_final = RandomForestRegressor(n_estimators=200, max_depth=8, random_state=42)
    modelo_final.fit(X, y)
    joblib.dump(modelo_final, WAIT_TIME_MODEL_PATH)
    print(f"Modelo guardado en {WAIT_TIME_MODEL_PATH}")


def entrenar_no_show(conn) -> None:
    print("\n=== Entrenando modelo de clasificacion: riesgo de inasistencia ===")
    query = """
        SELECT id, patient_id, doctor_id, fecha, estado, created_at
        FROM appointments
        WHERE estado IN ('COMPLETADA', 'NO_ASISTIO')
        ORDER BY patient_id, created_at
    """
    df = pd.read_sql(query, conn)
    print(f"Citas con resultado conocido (completada o no-asistio): {len(df)}")

    if len(df) < MIN_REGISTROS_CLASIFICACION:
        print(f"Insuficiente historico (< {MIN_REGISTROS_CLASIFICACION}); no se entrena el modelo. "
              "El servicio seguira usando la heuristica de respaldo.")
        return

    df["fecha"] = pd.to_datetime(df["fecha"]).dt.date
    df["created_at_date"] = pd.to_datetime(df["created_at"]).dt.date
    df["dia_semana"] = df["fecha"].apply(python_weekday_to_dia_semana)
    df["dias_anticipacion"] = (
        pd.to_datetime(df["fecha"]) - pd.to_datetime(df["created_at_date"])
    ).dt.days.clip(lower=0)
    df["es_no_show"] = (df["estado"] == "NO_ASISTIO").astype(int)

    # Inasistencias previas del paciente: conteo acumulado de NO_ASISTIO ANTES de esta cita
    # (ya viene ordenado por patient_id, created_at, por eso el cumsum + shift funciona).
    df["inasistencias_previas"] = (
        df.groupby("patient_id")["es_no_show"].cumsum().shift(fill_value=0)
    )
    df.loc[df.groupby("patient_id").cumcount() == 0, "inasistencias_previas"] = 0

    X = df[["doctor_id", "dia_semana", "dias_anticipacion", "inasistencias_previas"]]
    y = df["es_no_show"]
    print(f"Proporcion de no-show en los datos: {y.mean():.1%}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    modelo = RandomForestClassifier(
        n_estimators=200, max_depth=6, class_weight="balanced", random_state=42
    )
    modelo.fit(X_train, y_train)

    y_pred = modelo.predict(X_test)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    cm = confusion_matrix(y_test, y_pred)
    print(f"Precision (conjunto de prueba, {len(X_test)} registros): {precision:.2f}")
    print(f"Recall: {recall:.2f}")
    print(f"F1-score: {f1:.2f}")
    print(f"Matriz de confusion [[TN, FP], [FN, TP]]:\n{cm}")

    modelo_final = RandomForestClassifier(
        n_estimators=200, max_depth=6, class_weight="balanced", random_state=42
    )
    modelo_final.fit(X, y)
    joblib.dump(modelo_final, NO_SHOW_MODEL_PATH)
    print(f"Modelo guardado en {NO_SHOW_MODEL_PATH}")


def main():
    conn = get_connection()
    try:
        entrenar_wait_time(conn)
        entrenar_no_show(conn)
    finally:
        conn.close()
    print("\nEntrenamiento completo.")


if __name__ == "__main__":
    main()
