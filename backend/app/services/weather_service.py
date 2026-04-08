from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

OPEN_METEO_BASE_URL = "https://api.open-meteo.com/v1/forecast"


def _safe_number(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def compute_weather_severity(
    precipitation_mm: float,
    wind_speed_kmh: float,
    temperature_c: float,
) -> int:
    score = 0.0

    if precipitation_mm >= 50:
        score += 45
    elif precipitation_mm >= 25:
        score += 30
    elif precipitation_mm >= 10:
        score += 15

    if wind_speed_kmh >= 60:
        score += 35
    elif wind_speed_kmh >= 40:
        score += 22
    elif wind_speed_kmh >= 25:
        score += 10

    if temperature_c >= 42 or temperature_c <= 0:
        score += 20
    elif temperature_c >= 37:
        score += 10

    return max(0, min(100, round(score)))


async def fetch_weather_for_location(lat: float, lng: float) -> Dict[str, Any]:
    params = {
        "latitude": lat,
        "longitude": lng,
        "current": [
            "temperature_2m",
            "precipitation",
            "wind_speed_10m",
        ],
        "timezone": "auto",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(OPEN_METEO_BASE_URL, params=params)
        response.raise_for_status()
        return response.json()


def normalize_weather_signal(
    supplier: Dict[str, Any],
    api_payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    current = api_payload.get("current", {})
    if not current:
        return None

    precipitation_mm = _safe_number(current.get("precipitation"))
    wind_speed_kmh = _safe_number(current.get("wind_speed_10m"))
    temperature_c = _safe_number(current.get("temperature_2m"))

    severity = compute_weather_severity(
        precipitation_mm=precipitation_mm,
        wind_speed_kmh=wind_speed_kmh,
        temperature_c=temperature_c,
    )

    return {
        "source": "open-meteo",
        "entity_type": "supplier",
        "entity_id": str(supplier.get("_id") or supplier.get("id")),
        "supplier_name": supplier.get("name"),
        "location_name": supplier.get("location") or supplier.get("city") or supplier.get("country"),
        "country": supplier.get("country"),
        "lat": supplier.get("lat"),
        "lng": supplier.get("lng"),
        "signal_type": "weather_risk",
        "severity": severity,
        "confidence": 0.85,
        "event_time": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc),
        "features": {
            "precipitation_mm": precipitation_mm,
            "wind_speed_kmh": wind_speed_kmh,
            "temperature_c": temperature_c,
        },
        "raw_payload": api_payload,
    }