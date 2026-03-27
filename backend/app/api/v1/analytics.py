from fastapi import APIRouter
from app.services.analytics_service import (
    get_analytics_overview,
    get_forecast_series,
    get_supplier_exposure,
    get_lane_pressure,
)

router = APIRouter()


@router.get("/overview")
async def analytics_overview():
    return await get_analytics_overview()


@router.get("/forecast")
async def analytics_forecast():
    return await get_forecast_series()


@router.get("/supplier-exposure")
async def analytics_supplier_exposure():
    return await get_supplier_exposure()


@router.get("/lane-pressure")
async def analytics_lane_pressure():
    return await get_lane_pressure()