from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.services.emerging_signal_ml_service import predict_emerging_signal

router = APIRouter()


class EmergingSignalRequest(BaseModel):
    source_type: str
    title: Optional[str] = None
    summary: Optional[str] = None
    port_name: Optional[str] = None
    country: Optional[str] = None
    keyword_hits: float = 0
    sentiment_score: float = 0
    contains_disruption_terms: float = 0
    published_age_hours: float = 0
    temperature_c: float = 0
    precipitation_mm: float = 0
    wind_speed_kmh: float = 0
    weather_score: float = 0
    shipment_count: float = 0
    avg_delay_hours: float = 0
    avg_customs_clearance_hours: float = 0
    congestion_score: float = 0


@router.post("/predict")
async def predict_signal(payload: EmergingSignalRequest):
    try:
        return predict_emerging_signal(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Emerging signal prediction failed: {exc}")