from fastapi import APIRouter, Query

from app.schemas.analytics import (
    AnalyticsOverviewResponse,
    AnalyticsTimeSeriesPointResponse,
    ForecastPointResponse,
    LanePressureItemResponse,
    SupplierExposureItemResponse,
)
from app.schemas.dashboard import DashboardOverviewResponse
from app.services.analytics_service import (
    get_analytics_forecast,
    get_analytics_overview,
    get_analytics_time_series,
    get_lane_pressure,
    get_supplier_exposure,
)
from app.services.dashboard_service import get_dashboard_overview
from app.services.logistics_service import (
    get_logistics_overview,
    get_logistics_timeseries,
)
from app.services.map_service import get_map_points

router = APIRouter()
dashboard_router = APIRouter()
map_router = APIRouter()
logistics_router = APIRouter()


@dashboard_router.get("/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview():
    return await get_dashboard_overview()


@map_router.get("/points")
async def map_points(limit: int = Query(default=500, ge=1, le=5000)):
    return await get_map_points(limit=limit)


@logistics_router.get("/overview")
async def logistics_overview():
    return await get_logistics_overview()


@logistics_router.get("/timeseries")
async def logistics_timeseries():
    return await get_logistics_timeseries()


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
