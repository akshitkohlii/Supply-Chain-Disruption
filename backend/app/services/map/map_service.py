from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from app.core.database import get_database
from app.services.ports.port_service import get_active_ports

_CACHE_TTL_SECONDS = 20
_map_points_cache: dict[str, tuple[datetime, Any]] = {}


def _get_cached(key: str):
    cached = _map_points_cache.get(key)
    if not cached:
        return None
    cached_at, value = cached
    if datetime.now(timezone.utc) - cached_at >= timedelta(seconds=_CACHE_TTL_SECONDS):
        _map_points_cache.pop(key, None)
        return None
    return value


def _set_cached(key: str, value: Any):
    _map_points_cache[key] = (datetime.now(timezone.utc), value)
    return value


def _signal_level(weather_score: int, news_score: int) -> str:
    max_score = max(weather_score, news_score)
    if max_score >= 85:
        return "critical"
    if max_score >= 45:
        return "warning"
    return "stable"


async def get_map_points(limit: int = 500) -> List[Dict[str, Any]]:
    cache_key = f"points:{limit}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    db = get_database()

    ports = await get_active_ports()

    weather_docs = await db.weather_signals.find({}).sort("fetched_at", -1).to_list(length=5000)
    latest_weather: Dict[str, Dict[str, Any]] = {}
    for doc in weather_docs:
        entity_id = str(doc.get("entity_id"))
        if entity_id and entity_id not in latest_weather:
            latest_weather[entity_id] = doc

    news_docs = await db.news_signals.find({}).sort("fetched_at", -1).to_list(length=5000)
    latest_news: Dict[str, Dict[str, Any]] = {}
    for doc in news_docs:
        entity_id = str(doc.get("entity_id"))
        if entity_id and entity_id not in latest_news:
            latest_news[entity_id] = doc

    points: List[Dict[str, Any]] = []

    for port in ports[:limit]:
        if port.get("lat") is None or port.get("lng") is None:
            continue
        entity_id = str(port.get("_id"))
        weather_doc = latest_weather.get(entity_id, {})
        news_doc = latest_news.get(entity_id, {})

        weather_score = int(weather_doc.get("severity", 0) or 0)
        news_score = int(news_doc.get("severity", 0) or 0)
        level = _signal_level(weather_score, news_score)

        if weather_score >= news_score and weather_score > 0:
            summary = f"Weather-related disruption signal at {port.get('port_name')}."
        elif news_score > 0:
            summary = f"News-related disruption signal at {port.get('port_name')}."
        else:
            summary = f"No major live disruption signal at {port.get('port_name')}."

        points.append(
            {
                "id": entity_id,
                "name": port.get("port_name"),
                "lat": port.get("lat"),
                "lng": port.get("lng"),
                "country": port.get("country"),
                "level": level,
                "weatherScore": weather_score,
                "newsScore": news_score,
                "summary": summary,
            }
        )

    return _set_cached(cache_key, points)
