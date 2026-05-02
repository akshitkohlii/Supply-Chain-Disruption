from fastapi import APIRouter, HTTPException

from app.schemas.mitigation import MitigationPlanResponse
from app.services.mitigation.mitigation_service import get_mitigation_plan

router = APIRouter()


@router.get("/{alert_id}", response_model=MitigationPlanResponse)
async def mitigation_plan(alert_id: str):
    try:
        return await get_mitigation_plan(alert_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to build mitigation plan: {exc}")
