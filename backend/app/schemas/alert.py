from pydantic import BaseModel, Field
from typing import Literal


RiskLevel = Literal["stable", "warning", "critical"]
AlertStatus = Literal["active", "acknowledged", "resolved"]
AlertCategory = Literal["supplier", "port", "climate", "geo", "logistics"]


class AlertScoresResponse(BaseModel):
    weather: int | None = None
    news: int | None = None
    logistics: int | None = None
    congestion: int | None = None
    emerging: int | None = None
    final_risk: int | None = None
    ml: int | None = None


class AlertMlPredictionResponse(BaseModel):
    disruption_probability: float | None = None
    ml_risk_score: int | None = None
    predicted_delay_hours: float | None = None
    top_factors: list[str] = []


SignalSource = Literal["news", "weather", "congestion"]
SignalSeverity = Literal["low", "medium", "high"]


class EmergingImpactSignalResponse(BaseModel):
    signal_id: str
    source_type: SignalSource
    risk_type: str | None = None
    severity: SignalSeverity
    port_name: str | None = None
    emerging_score: int | None = None
    impact_score: int
    title: str | None = None


class EmergingImpactResponse(BaseModel):
    score: int | None = None
    top_ports: list[str] = []
    signals: list[EmergingImpactSignalResponse] = []


class AlertResponse(BaseModel):
    _id: str | None = None
    alert_id: str
    entity_type: Literal["route", "port"] = "route"
    entity_id: str | None = None
    route_key: str | None = None
    title: str
    location: str
    country: str | None = None
    category: AlertCategory
    level: RiskLevel
    status: AlertStatus
    timestamp: str
    summary: str

    lat: float | None = None
    lng: float | None = None

    origin_port: str | None = None
    destination_port: str | None = None
    related_origin_port: str | None = None
    related_destination_port: str | None = None
    shipment_id: str | None = None
    business_unit: str | None = None
    supplier_name: str | None = None

    weather_score: int | None = None
    news_score: int | None = None
    logistics_score: int | None = None
    congestion_score: int | None = None
    emerging_score: int | None = None
    final_risk: int | None = None
    scores: AlertScoresResponse | None = None
    ml_prediction: AlertMlPredictionResponse | None = None
    emerging_impact: EmergingImpactResponse | None = None
    top_drivers: list[str] = []
    updated_at: str | None = None


class AlertSummaryResponse(BaseModel):
    total_alerts: int
    active_alerts: int
    critical_alerts: int
    warning_alerts: int
    top_category: str


class AlertStatusUpdateResponse(BaseModel):
    message: str
    alert_id: str
    status: AlertStatus


class AlertGenerationResponse(BaseModel):
    success: bool
    routes_evaluated: int = Field(ge=0)
    alerts_upserted: int = Field(ge=0)
    skipped: int = Field(ge=0)
    critical_risk_threshold: int = Field(ge=0, le=100)
    warning_risk_threshold: int = Field(ge=0, le=100)


class AlertThresholdSettingsResponse(BaseModel):
    critical_risk_threshold: int = Field(ge=0, le=100)
    warning_risk_threshold: int = Field(ge=0, le=100)
    regenerate_alerts: bool | None = None
    generation_result: AlertGenerationResponse | None = None


class AlertThresholdSettingsUpdateRequest(BaseModel):
    critical_risk_threshold: int = Field(ge=0, le=100)
    warning_risk_threshold: int = Field(ge=0, le=100)
    regenerate_alerts: bool = True
