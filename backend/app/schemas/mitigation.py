from pydantic import BaseModel, Field
from typing import Literal


Priority = Literal["low", "medium", "high"]


class MitigationScenarioResponse(BaseModel):
    id: str
    label: str
    risk_score: float
    delay_hours: float
    recovery_days: float
    cost_impact: float


class ReroutePlanResponse(BaseModel):
    from_: str = Field(alias="from", serialization_alias="from")
    to: str
    eta_savings_hours: float

    model_config = {
        "populate_by_name": True,
    }


class StockPlanResponse(BaseModel):
    supplier: str
    sku_group: str
    current_days_cover: float
    recommended_days_cover: float
    increase_percent: float


class MitigationPlanResponse(BaseModel):
    id: str
    alert_id: str
    title: str
    priority: Priority
    confidence: float
    impact_reduction: float
    reason: str
    actions: list[str]
    reroute_plan: ReroutePlanResponse | None = None
    stock_plan: StockPlanResponse | None = None
    scenarios: list[MitigationScenarioResponse]