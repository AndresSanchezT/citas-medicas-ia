import os
import joblib
from app.schemas import (
    WaitTimeRequest, WaitTimePrediction,
    NoShowRequest, NoShowPrediction,
)

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
WAIT_TIME_MODEL_PATH = os.path.join(MODELS_DIR, "wait_time_regressor.joblib")
NO_SHOW_MODEL_PATH = os.path.join(MODELS_DIR, "no_show_classifier.joblib")

_wait_time_model = None
_no_show_model = None

if os.path.exists(WAIT_TIME_MODEL_PATH):
    _wait_time_model = joblib.load(WAIT_TIME_MODEL_PATH)

if os.path.exists(NO_SHOW_MODEL_PATH):
    _no_show_model = joblib.load(NO_SHOW_MODEL_PATH)


def predict_wait_time(req: WaitTimeRequest) -> WaitTimePrediction:
    if _wait_time_model is not None:
        features = [[req.doctor_id, req.specialty_id, req.dia_semana, req.hora]]
        minutos = int(round(_wait_time_model.predict(features)[0]))
        return WaitTimePrediction(
            tiempo_estimado_minutos=minutos,
            confianza="alta",
            basado_en=f"Modelo de regresión entrenado (médico {req.doctor_id}, día {req.dia_semana}, hora {req.hora})",
        )

    # Sin modelo entrenado todavía (no hay histórico suficiente): heurística de respaldo.
    return WaitTimePrediction(
        tiempo_estimado_minutos=20,
        confianza="baja",
        basado_en="Heurística de respaldo (aún no hay modelo entrenado ni histórico suficiente)",
    )


def predict_no_show_risk(req: NoShowRequest) -> NoShowPrediction:
    if _no_show_model is not None:
        features = [[req.doctor_id, req.dia_semana, req.dias_anticipacion, req.inasistencias_previas]]
        proba = float(_no_show_model.predict_proba(features)[0][1])
        nivel = "alto" if proba >= 0.6 else "medio" if proba >= 0.3 else "bajo"
        return NoShowPrediction(probabilidad_no_show=round(proba, 2), nivel_riesgo=nivel)

    # Sin modelo entrenado todavía: heurística simple basada en inasistencias previas.
    proba = min(0.1 * req.inasistencias_previas, 0.9)
    nivel = "alto" if proba >= 0.6 else "medio" if proba >= 0.3 else "bajo"
    return NoShowPrediction(probabilidad_no_show=round(proba, 2), nivel_riesgo=nivel)
