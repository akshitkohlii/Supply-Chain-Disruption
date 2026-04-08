from fastapi import APIRouter

from app.services.analytics_service import (
    get_analytics_forecast,
    get_analytics_overview,
    get_lane_pressure,
    get_supplier_exposure,
)

router = APIRouter()


@router.get("/overview")
async def analytics_overview():
    return await get_analytics_overview()


@router.get("/forecast")
async def analytics_forecast():
    return await get_analytics_forecast()


@router.get("/supplier-exposure")
async def supplier_exposure():
    return await get_supplier_exposure()


@router.get("/lane-pressure")
async def lane_pressure():
    return await get_lane_pressure()