from fastapi import FastAPI
from app.schemas import WaitTimeRequest, WaitTimePrediction, NoShowRequest, NoShowPrediction
from app.prediction import predict_wait_time, predict_no_show_risk

app = FastAPI(title="Servicio de IA - Predicción de citas médicas")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict/wait-time", response_model=WaitTimePrediction)
def wait_time(req: WaitTimeRequest):
    return predict_wait_time(req)


@app.post("/predict/no-show-risk", response_model=NoShowPrediction)
def no_show_risk(req: NoShowRequest):
    return predict_no_show_risk(req)
