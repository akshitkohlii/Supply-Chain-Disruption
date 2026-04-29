from pydantic import BaseModel


class DashboardOverviewResponse(BaseModel):
    globalRiskScore: float
    criticalAlerts: int
    highRiskRoutes: int
    delayedShipmentsPercent: float
    avgRouteDelayHours: float


class DashboardFilterOptionsResponse(BaseModel):
    business_units: list[str]
