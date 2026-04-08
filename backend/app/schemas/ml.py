from pydantic import BaseModel
from typing import List, Optional


class RoutePredictionResponse(BaseModel):
    route_key: str
    disruption_probability: float
    predicted_label: str
    ml_risk_score: int
    predicted_delay_hours: float
    top_factors: List[str]


class ModelInfoResponse(BaseModel):
    model_loaded: bool
    model_path: Optional[str] = None