from fastapi import APIRouter, Query
from app.services.map_service import get_map_points

router = APIRouter()


@router.get("/points")
async def map_points(limit: int = Query(default=500, ge=1, le=5000)):
    return await get_map_points(limit=limit)