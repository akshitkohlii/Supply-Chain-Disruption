from fastapi import APIRouter, Query, HTTPException
from app.services.alert_service import (
    get_all_alerts,
    get_alert_summary,
    update_alert_status,
)

router = APIRouter()


@router.get("/")
async def list_alerts(limit: int = Query(default=50, ge=1, le=500)):
    return await get_all_alerts(limit=limit)


@router.get("/summary")
async def alerts_summary():
    return await get_alert_summary()


@router.patch("/{alert_id}/status")
async def change_alert_status(alert_id: str, status: str):
    if status not in {"active", "acknowledged", "resolved"}:
        raise HTTPException(status_code=400, detail="Invalid status")

    updated = await update_alert_status(alert_id, status)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found")

    return {"message": "Alert status updated", "alert_id": alert_id, "status": status}