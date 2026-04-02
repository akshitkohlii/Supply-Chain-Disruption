from fastapi import APIRouter, HTTPException
from app.services.mitigation_service import get_mitigation_by_alert_id

router = APIRouter()


@router.get("/{alert_id}")
async def mitigation_by_alert_id(alert_id: str):
    result = await get_mitigation_by_alert_id(alert_id)

    if not result:
        raise HTTPException(status_code=404, detail="Mitigation plan not found")

    return result