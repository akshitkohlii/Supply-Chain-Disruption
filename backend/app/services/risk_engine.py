from typing import Any, Dict


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def calculate_logistics_score(shipment: Dict[str, Any] | None) -> int:
    if not shipment:
        return 0

    delay_hours = float(shipment.get("delay_hours") or 0)
    inventory_impact = float(shipment.get("inventory_impact_score") or 0)

    score = 0.0

    if delay_hours >= 72:
        score += 60
    elif delay_hours >= 48:
        score += 40
    elif delay_hours >= 24:
        score += 20
    elif delay_hours > 0:
        score += 10

    score += inventory_impact * 30
    return clamp_score(score)


def calculate_supplier_history_score(supplier: Dict[str, Any]) -> int:
    return clamp_score(float(supplier.get("historical_risk_score") or 0))


def calculate_inventory_score(shipment: Dict[str, Any] | None) -> int:
    if not shipment:
        return 0
    return clamp_score(float(shipment.get("inventory_impact_score") or 0) * 100)


def compute_final_risk(
    weather_score: int,
    news_score: int,
    logistics_score: int,
    supplier_history_score: int,
    inventory_score: int,
) -> int:
    weighted_score = (
        0.25 * weather_score
        + 0.20 * news_score
        + 0.20 * logistics_score
        + 0.20 * supplier_history_score
        + 0.15 * inventory_score
    )
    return clamp_score(weighted_score)


def get_risk_level(final_risk: int) -> str:
    if final_risk >= 65:
        return "critical"
    if final_risk >= 35:
        return "warning"
    return "stable"


def build_risk_snapshot(
    supplier: Dict[str, Any],
    weather_signal: Dict[str, Any] | None,
    news_signal: Dict[str, Any] | None,
    shipment: Dict[str, Any] | None,
) -> Dict[str, Any]:
    weather_score = int((weather_signal or {}).get("severity", 0))
    news_score = int((news_signal or {}).get("severity", 0))
    logistics_score = calculate_logistics_score(shipment)
    supplier_history_score = calculate_supplier_history_score(supplier)
    inventory_score = calculate_inventory_score(shipment)

    final_risk = compute_final_risk(
        weather_score=weather_score,
        news_score=news_score,
        logistics_score=logistics_score,
        supplier_history_score=supplier_history_score,
        inventory_score=inventory_score,
    )

    top_drivers = []
    if weather_score >= 40:
        top_drivers.append("weather")
    if news_score >= 40:
        top_drivers.append("news")
    if logistics_score >= 40:
        top_drivers.append("logistics")
    if supplier_history_score >= 50:
        top_drivers.append("supplier_history")
    if inventory_score >= 50:
        top_drivers.append("inventory")

    return {
        "entity_type": "supplier",
        "entity_id": str(supplier.get("_id") or supplier.get("id")),
        "supplier_name": supplier.get("name"),
        "country": supplier.get("country"),
        "location_name": supplier.get("location") or supplier.get("city") or supplier.get("country"),
        "lat": supplier.get("lat"),
        "lng": supplier.get("lng"),
        "scores": {
            "weather": weather_score,
            "news": news_score,
            "logistics": logistics_score,
            "supplier_history": supplier_history_score,
            "inventory": inventory_score,
            "final_risk": final_risk,
        },
        "risk_level": get_risk_level(final_risk),
        "top_drivers": top_drivers,
    }