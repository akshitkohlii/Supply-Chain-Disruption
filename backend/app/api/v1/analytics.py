from fastapi import APIRouter, Query

from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    AnalyticsTimeSeriesPointResponse,
    ForecastPointResponse,
    LanePressureItemResponse,
    SupplierExposureItemResponse,
)
from app.services.analytics.analytics_service import (
    get_analytics_forecast,
    get_analytics_overview,
    get_analytics_time_series,
    get_lane_pressure,
    get_supplier_exposure,
)

router = APIRouter()


@router.get("/overview", response_model=AnalyticsOverviewResponse)
async def analytics_overview():
    return await get_analytics_overview()


@router.get("/forecast", response_model=list[ForecastPointResponse])
async def analytics_forecast():
    return await get_analytics_forecast()


@router.get("/time-series", response_model=list[AnalyticsTimeSeriesPointResponse])
async def analytics_time_series(
    port: str | None = Query(default=None),
    lane: str | None = Query(default=None),
):
    return await get_analytics_time_series(port=port, lane=lane)


@router.get("/supplier-exposure", response_model=list[SupplierExposureItemResponse])
async def supplier_exposure():
    return await get_supplier_exposure()


@router.get("/lane-pressure", response_model=list[LanePressureItemResponse])
async def lane_pressure():
    return await get_lane_pressure()
