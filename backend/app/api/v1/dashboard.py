from fastapi import APIRouter
from app.services.dashboard_service import get_dashboard_overview

router = APIRouter()


@router.get("/overview")
async def dashboard_overview():
    return await get_dashboard_overview()