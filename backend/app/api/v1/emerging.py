from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.emerging_signal_service import (
    build_emerging_signals,
    get_emerging_signals,
    predict_emerging_signal,
)

emerging_signals_router = APIRouter()
emerging_ml_router = APIRouter()


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


@emerging_signals_router.get("")
async def list_emerging_signals(
    limit: int = Query(20, ge=1, le=100),
    relevant_only: bool = Query(True),
    source_type: str | None = Query(None),
):
    try:
        return await get_emerging_signals(
            limit=limit,
            relevant_only=relevant_only,
            source_type=source_type,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch emerging signals: {exc}")


@emerging_signals_router.post("/build")
async def rebuild_emerging_signals(
    limit_per_source: int = Query(200, ge=1, le=1000),
    save_all: bool = Query(True),
):
    try:
        return await build_emerging_signals(
            limit_per_source=limit_per_source,
            save_all=save_all,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build emerging signals: {exc}")


@emerging_ml_router.post("/predict")
async def predict_signal(payload: EmergingSignalRequest):
    try:
        return predict_emerging_signal(payload.model_dump())
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Emerging signal prediction failed: {exc}")
