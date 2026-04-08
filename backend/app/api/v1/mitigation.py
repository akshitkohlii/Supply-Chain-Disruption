from fastapi import APIRouter, HTTPException

from app.services.mitigation_service import get_mitigation_plan

router = APIRouter()


@router.get("/{alert_id}")
async def mitigation_plan(alert_id: str):
    try:
      return await get_mitigation_plan(alert_id)
    except ValueError as exc:
      raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
      raise HTTPException(status_code=500, detail=f"Failed to build mitigation plan: {exc}")