from pydantic import BaseModel


class AnalyticsOverviewResponse(BaseModel):
    avg_forecast_risk: float
    forecast_drift: float
    avg_supplier_risk: float
    critical_alerts: int
    avg_delay_hours: float


class ForecastPointResponse(BaseModel):
    day: str
    today_baseline: float
    forecast_risk: float
    drift: float


class AnalyticsTimeSeriesPointResponse(BaseModel):
    day: str
    date: str
    current_risk: float
    forecast_risk: float
    drift: float
    weather_score: float
    news_score: float
    congestion_score: float
    logistics_score: float
    emerging_score: float
    route_count: int


class SupplierExposureItemResponse(BaseModel):
    supplier_id: str
    supplier_name: str
    supplier_country: str
    supplier_region: str
    risk_score: float
    dependency_score: float


class LanePressureItemResponse(BaseModel):
    lane: str
    origin_port: str
    destination_port: str
    pressure_score: float
    delay_hours: float
    throughput_pct: float
    shipment_count: int
