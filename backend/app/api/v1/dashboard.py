from fastapi import APIRouter

from app.schemas.dashboard import (
    DashboardFilterOptionsResponse,
    DashboardOverviewResponse,
)
from app.services.dashboard.dashboard_service import (
    get_dashboard_filter_options,
    get_dashboard_overview,
)

router = APIRouter()


@router.get("/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview():
    return await get_dashboard_overview()


@router.get("/filter-options", response_model=DashboardFilterOptionsResponse)
async def dashboard_filter_options():
    return await get_dashboard_filter_options()
