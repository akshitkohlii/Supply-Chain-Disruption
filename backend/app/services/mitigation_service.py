from typing import Any, Dict

from app.services.mitigation_ml_service import build_ml_mitigation_plan


async def get_mitigation_plan(alert_id: str) -> Dict[str, Any]:
    plan = await build_ml_mitigation_plan(alert_id)

    if not plan:
        return {
            "id": f"mitigation::{alert_id}",
            "alert_id": alert_id,
            "title": "Mitigation plan unavailable",
            "priority": "medium",
            "confidence": 55,
            "impact_reduction": 10,
            "reason": "No mitigation plan could be generated for this alert.",
            "actions": [
                "Review route exposure manually.",
                "Prepare contingency inventory.",
                "Increase monitoring frequency.",
            ],
            "reroute_plan": None,
            "stock_plan": None,
            "scenarios": [
                {
                    "id": "fallback",
                    "label": "Manual review",
                    "risk_score": 45,
                    "delay_hours": 24.0,
                    "recovery_days": 2.0,
                    "cost_impact": 10,
                }
            ],
        }

    return plan