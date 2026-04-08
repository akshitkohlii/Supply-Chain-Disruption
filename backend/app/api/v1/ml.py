from fastapi import APIRouter, HTTPException, Query

from app.schemas.ml import ModelInfoResponse, RoutePredictionResponse
from app.services.ml_service import get_model_info, predict_route_disruption

router = APIRouter()


@router.get("/model-info", response_model=ModelInfoResponse)
async def model_info():
    return get_model_info()


@router.get("/predict-route", response_model=RoutePredictionResponse)
async def predict_route(
    route_key: str | None = Query(None),
    origin_port: str | None = Query(None),
    destination_port: str | None = Query(None),
    weather_score: int = Query(0, ge=0, le=100),
    news_score: int = Query(0, ge=0, le=100),
    congestion_score: int = Query(0, ge=0, le=100),
):
    try:
        return await predict_route_disruption(
            route_key=route_key,
            origin_port=origin_port,
            destination_port=destination_port,
            weather_score=weather_score,
            news_score=news_score,
            congestion_score=congestion_score,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")