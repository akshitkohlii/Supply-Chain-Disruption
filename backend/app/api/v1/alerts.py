from fastapi import APIRouter, HTTPException, Query

from app.schemas.alert import (
    AlertGenerationResponse,
    AlertResponse,
    AlertStatusUpdateResponse,
    AlertSummaryResponse,
    AlertThresholdSettingsResponse,
    AlertThresholdSettingsUpdateRequest,
)
from app.services.alerts.alert_service import (
    generate_alerts_from_snapshots,
    get_alert_threshold_settings,
    get_alert_summary as service_get_alert_summary,
    list_alerts as service_list_alerts,
    update_alert_threshold_settings,
    update_alert_status as service_update_alert_status,
)

router = APIRouter()


@router.get("", response_model=list[AlertResponse])
async def list_alerts(limit: int = Query(50, ge=1, le=500)):
    return await service_list_alerts(limit=limit)


@router.get("/summary", response_model=AlertSummaryResponse)
async def alert_summary():
    return await service_get_alert_summary()


@router.post("/generate", response_model=AlertGenerationResponse)
async def generate_alerts():
    return await generate_alerts_from_snapshots()


@router.get("/settings", response_model=AlertThresholdSettingsResponse)
async def get_alert_settings():
    return await get_alert_threshold_settings()


@router.put("/settings", response_model=AlertThresholdSettingsResponse)
async def put_alert_settings(payload: AlertThresholdSettingsUpdateRequest):
    try:
        return await update_alert_threshold_settings(
            critical_risk_threshold=payload.critical_risk_threshold,
            warning_risk_threshold=payload.warning_risk_threshold,
            regenerate_alerts=payload.regenerate_alerts,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.patch("/{alert_id}/status", response_model=AlertStatusUpdateResponse)
async def patch_alert_status(
    alert_id: str,
    status: str = Query(..., pattern="^(active|acknowledged|resolved)$"),
):
    try:
        return await service_update_alert_status(alert_id=alert_id, status=status)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
