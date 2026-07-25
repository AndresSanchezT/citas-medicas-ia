# Servicio de IA — Predicción de citas médicas

Servicio independiente (Python + FastAPI) que expone dos modelos entrenados con scikit-learn:

- `POST /predict/wait-time` — tiempo de espera estimado (regresión, `RandomForestRegressor`).
- `POST /predict/no-show-risk` — riesgo de inasistencia (clasificación, `RandomForestClassifier`).

El backend NestJS consulta este servicio como fuente primaria de predicción; si no responde
(apagado, timeout), cae automáticamente en la heurística de respaldo (promedio ponderado /
conteo de inasistencias previas), así que el sistema completo sigue funcionando sin este
servicio, solo con predicciones menos precisas.

## Puesta en marcha

Requiere que la base de datos ya tenga datos (ver los scripts de siembra en `backend/prisma/`),
ya que el entrenamiento lee el histórico real de citas.

```bash
cd ai-service
python -m venv .venv

# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # ajustar DATABASE_URL si tu MySQL no usa root:root
```

Entrenar los modelos (regenera `app/models/*.joblib`, no versionados en git):

```bash
python train.py
```

Levantar el servicio:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Verificar en `http://localhost:8000/health`.

El backend lo busca en `AI_SERVICE_URL` (ver `backend/.env.example`), por defecto
`http://localhost:8000` — si usas otro puerto, actualiza esa variable también en `backend/.env`.

## Reentrenar tras sembrar más datos

Cada vez que se resiembra la base de datos de demo (`backend/prisma/reset-demo-data.ts` +
los scripts `seed-*.ts`), conviene volver a correr `python train.py` para que los modelos
reflejen el histórico actual.

## Sin modelo entrenado todavía

Si `app/models/*.joblib` no existe (por ejemplo, antes de la primera ejecución de
`train.py`, o si el histórico es insuficiente), ambos endpoints responden igual pero con
una heurística de respaldo simple (ver `app/prediction.py`), para que el servicio nunca
falle por falta de modelo.
