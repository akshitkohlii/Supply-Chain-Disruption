from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings

OPEN_WEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"
OPEN_WEATHER_ONE_CALL_URL = "https://api.openweathermap.org/data/3.0/onecall"


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
    weather_code: int | None = None,
    wind_gust_kmh: float = 0.0,
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

    if wind_gust_kmh >= 75:
        score += 15
    elif wind_gust_kmh >= 55:
        score += 8

    if temperature_c >= 42 or temperature_c <= 0:
        score += 20
    elif temperature_c >= 37:
        score += 10

    if weather_code is not None:
        if 200 <= weather_code < 300:
            score += 25
        elif 500 <= weather_code < 600:
            score += 12
        elif 600 <= weather_code < 700:
            score += 15
        elif 700 <= weather_code < 800:
            score += 10
        elif weather_code == 781:
            score += 30

    return max(0, min(100, round(score)))


def _precipitation_mm(bucket: Dict[str, Any]) -> float:
    one_hour = _safe_number(bucket.get("1h"))
    three_hour = _safe_number(bucket.get("3h"))
    if one_hour > 0:
        return one_hour
    if three_hour > 0:
        return three_hour / 3.0
    return 0.0


def extract_weather_metrics(api_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    main = api_payload.get("main", {})
    wind = api_payload.get("wind", {})
    rain = api_payload.get("rain", {})
    snow = api_payload.get("snow", {})
    weather_items = api_payload.get("weather") or []

    if not main:
        return None

    primary_weather = weather_items[0] if weather_items else {}
    rain_mm = _precipitation_mm(rain)
    snow_mm = _precipitation_mm(snow)
    precipitation_mm = rain_mm + snow_mm
    wind_speed_kmh = _safe_number(wind.get("speed")) * 3.6
    wind_gust_kmh = _safe_number(wind.get("gust")) * 3.6
    temperature_c = _safe_number(main.get("temp"))
    feels_like_c = _safe_number(main.get("feels_like"), temperature_c)
    weather_code = int(primary_weather.get("id")) if primary_weather.get("id") is not None else None

    severity = compute_weather_severity(
        precipitation_mm=precipitation_mm,
        wind_speed_kmh=wind_speed_kmh,
        temperature_c=temperature_c,
        weather_code=weather_code,
        wind_gust_kmh=wind_gust_kmh,
    )

    return {
        "precipitation_mm": precipitation_mm,
        "wind_speed_kmh": wind_speed_kmh,
        "wind_gust_kmh": wind_gust_kmh,
        "temperature_c": temperature_c,
        "feels_like_c": feels_like_c,
        "weather_code": weather_code,
        "weather_main": primary_weather.get("main"),
        "weather_description": primary_weather.get("description"),
        "severity": severity,
    }


def extract_daily_forecast_metrics(day_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    temp = day_payload.get("temp") or {}
    weather_items = day_payload.get("weather") or []
    primary_weather = weather_items[0] if weather_items else {}

    temperature_c = _safe_number(temp.get("day"))
    if not temp and temperature_c == 0.0 and not weather_items and not day_payload:
        return None

    rain_mm = _safe_number(day_payload.get("rain"))
    snow_mm = _safe_number(day_payload.get("snow"))
    precipitation_mm = max(0.0, rain_mm) + max(0.0, snow_mm)
    wind_speed_kmh = _safe_number(day_payload.get("wind_speed")) * 3.6
    wind_gust_kmh = _safe_number(day_payload.get("wind_gust")) * 3.6
    weather_code = (
        int(primary_weather.get("id"))
        if primary_weather.get("id") is not None
        else None
    )

    severity = compute_weather_severity(
        precipitation_mm=precipitation_mm,
        wind_speed_kmh=wind_speed_kmh,
        temperature_c=temperature_c,
        weather_code=weather_code,
        wind_gust_kmh=wind_gust_kmh,
    )

    timestamp = day_payload.get("dt")
    forecast_time = (
        datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
        if timestamp is not None
        else None
    )

    return {
        "forecast_time": forecast_time,
        "precipitation_mm": precipitation_mm,
        "wind_speed_kmh": wind_speed_kmh,
        "wind_gust_kmh": wind_gust_kmh,
        "temperature_c": temperature_c,
        "weather_code": weather_code,
        "weather_main": primary_weather.get("main"),
        "weather_description": primary_weather.get("description"),
        "severity": severity,
    }


async def fetch_weather_for_location(lat: float, lng: float) -> Dict[str, Any]:
    api_key = getattr(settings, "WEATHER_API_KEY", None)
    if not api_key:
        raise ValueError("WEATHER_API_KEY not configured")

    params = {
        "lat": lat,
        "lon": lng,
        "appid": api_key,
        "units": "metric",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(OPEN_WEATHER_BASE_URL, params=params)
        response.raise_for_status()
        return response.json()


async def fetch_daily_forecast_for_location(
    lat: float,
    lng: float,
    days: int = 7,
) -> list[Dict[str, Any]]:
    api_key = getattr(settings, "WEATHER_API_KEY", None)
    if not api_key:
        raise ValueError("WEATHER_API_KEY not configured")

    params = {
        "lat": lat,
        "lon": lng,
        "appid": api_key,
        "units": "metric",
        "exclude": "current,minutely,hourly,alerts",
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(OPEN_WEATHER_ONE_CALL_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    daily_items = payload.get("daily") or []
    results: list[Dict[str, Any]] = []

    for item in daily_items[: max(1, days)]:
        metrics = extract_daily_forecast_metrics(item)
        if metrics:
            results.append(metrics)

    return results


def normalize_weather_signal(
    supplier: Dict[str, Any],
    api_payload: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    metrics = extract_weather_metrics(api_payload)
    if not metrics:
        return None

    return {
        "source": "openweather",
        "entity_type": "supplier",
        "entity_id": str(supplier.get("_id") or supplier.get("id")),
        "supplier_name": supplier.get("name"),
        "location_name": supplier.get("location") or supplier.get("city") or supplier.get("country"),
        "country": supplier.get("country"),
        "lat": supplier.get("lat"),
        "lng": supplier.get("lng"),
        "signal_type": "weather_risk",
        "severity": metrics["severity"],
        "confidence": 0.85,
        "event_time": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc),
        "features": {
            "precipitation_mm": metrics["precipitation_mm"],
            "wind_speed_kmh": metrics["wind_speed_kmh"],
            "wind_gust_kmh": metrics["wind_gust_kmh"],
            "temperature_c": metrics["temperature_c"],
            "feels_like_c": metrics["feels_like_c"],
            "weather_code": metrics["weather_code"],
            "weather_main": metrics["weather_main"],
            "weather_description": metrics["weather_description"],
        },
        "raw_payload": api_payload,
    }
