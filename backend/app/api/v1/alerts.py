from fastapi import APIRouter, Query

from app.services.alert_service import (
    generate_alerts_from_snapshots,
    get_alert_summary as service_get_alert_summary,
    list_alerts as service_list_alerts,
    update_alert_status as service_update_alert_status,
)

router = APIRouter()


@router.get("")
async def list_alerts(limit: int = Query(50, ge=1, le=500)):
    return await service_list_alerts(limit=limit)


@router.get("/summary")
async def alert_summary():
    return await service_get_alert_summary()


@router.post("/generate")
async def generate_alerts():
    return await generate_alerts_from_snapshots()


@router.patch("/{alert_id}/status")
async def patch_alert_status(
    alert_id: str,
    status: str = Query(..., pattern="^(active|acknowledged|resolved)$"),
):
    return await service_update_alert_status(alert_id=alert_id, status=status)