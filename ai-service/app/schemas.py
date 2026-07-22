from pydantic import BaseModel
from typing import Optional


class WaitTimeRequest(BaseModel):
    doctor_id: int
    specialty_id: int
    dia_semana: int  # 0-6
    hora: int  # 0-23


class WaitTimePrediction(BaseModel):
    tiempo_estimado_minutos: int
    confianza: str  # "alta" | "media" | "baja"
    basado_en: str


class NoShowRequest(BaseModel):
    patient_id: int
    doctor_id: int
    dia_semana: int
    dias_anticipacion: int
    inasistencias_previas: int


class NoShowPrediction(BaseModel):
    probabilidad_no_show: float
    nivel_riesgo: str  # "alto" | "medio" | "bajo"
