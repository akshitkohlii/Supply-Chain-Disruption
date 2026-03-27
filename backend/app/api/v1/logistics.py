from fastapi import APIRouter
from app.services.logistics_service import (
    get_logistics_overview,
    get_logistics_timeseries,
)

router = APIRouter()


@router.get("/overview")
async def logistics_overview():
    return await get_logistics_overview()


@router.get("/timeseries")
async def logistics_timeseries():
    return await get_logistics_timeseries()