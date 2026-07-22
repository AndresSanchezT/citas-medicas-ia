# Servicio de IA — Predicción de citas médicas

Servicio independiente (FastAPI) que expone dos modelos:

- `POST /predict/wait-time` — predicción de tiempo de espera (regresión).
- `POST /predict/no-show-risk` — predicción de riesgo de inasistencia (clasificación).

Mientras no exista un modelo entrenado en `app/models/`, ambos endpoints responden con una heurística de respaldo (ver `app/prediction.py`).

## Requisito pendiente

Este equipo todavía no tiene Python instalado. Antes de poder ejecutar este servicio:

1. Instalar Python 3.11 (https://www.python.org/downloads/).
2. Desde esta carpeta (`ai-service/`):
   ```
   python -m venv .venv
   .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8001
   ```
3. Verificar en `http://localhost:8001/health`.
