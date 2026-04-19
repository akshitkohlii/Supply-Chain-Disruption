from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, List

import httpx

from app.core.config import settings

NEWS_API_BASE_URL = "https://newsapi.org/v2/everything"

DISRUPTION_KEYWORDS = [
    "strike",
    "congestion",
    "disruption",
    "delay",
    "shutdown",
    "blockade",
    "customs",
    "backlog",
    "reroute",
    "closure",
]

REGIONAL_CONFLICT_HOTSPOTS = [
    {
        "id": "gulf_conflict",
        "trigger_terms": [
            "iran",
            "tehran",
            "us-iran",
            "u.s.-iran",
            "us iran",
            "american strike",
            "israeli strike",
            "strait of hormuz",
            "hormuz",
            "persian gulf",
            "gulf of oman",
            "iranian port",
            "naval blockade",
            "middle east conflict",
        ],
        "affected_countries": {
            "iran",
            "iraq",
            "kuwait",
            "bahrain",
            "qatar",
            "united arab emirates",
            "uae",
            "oman",
            "saudi arabia",
        },
        "center": {"lat": 26.5667, "lng": 56.25},
        "radius_km": 1800,
    }
]


def _normalize_name(value: str | None) -> str:
    if not value:
        return ""
    return value.strip()


def _normalize_country(value: str | None) -> str:
    if not value:
        return ""
    return value.strip().lower()


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    earth_radius_km = 6371.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = (
        sin(d_lat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    )
    return 2 * earth_radius_km * asin(sqrt(a))


def _entity_in_hotspot(entity: Dict[str, Any], hotspot: Dict[str, Any]) -> bool:
    country = _normalize_country(entity.get("country"))
    if country and country in hotspot["affected_countries"]:
        return True

    center = hotspot.get("center") or {}
    radius_km = _safe_float(hotspot.get("radius_km"), 0)
    entity_lat = _safe_float(entity.get("lat"), float("nan"))
    entity_lng = _safe_float(entity.get("lng"), float("nan"))
    center_lat = _safe_float(center.get("lat"), float("nan"))
    center_lng = _safe_float(center.get("lng"), float("nan"))

    if any(value != value for value in [entity_lat, entity_lng, center_lat, center_lng]):
        return False

    return _haversine_km(entity_lat, entity_lng, center_lat, center_lng) <= radius_km


def _port_query_variants(port_name: str) -> List[str]:
    port_name = _normalize_name(port_name)
    if not port_name:
        return []

    variants = [port_name]

    if port_name.lower().endswith(" port"):
        base = port_name[:-5].strip()
        if base:
            variants.append(base)

    return list(dict.fromkeys(variants))


def build_news_query(entity: Dict[str, Any]) -> str:
    """
    Builds a narrower, port-specific query.
    Example:
    ("Shanghai Port" OR "Shanghai") AND (strike OR congestion OR delay ...)
    """
    name = _normalize_name(
        entity.get("name")
        or entity.get("port_name")
        or entity.get("location")
        or ""
    )
    country = _normalize_name(entity.get("country"))

    name_variants = _port_query_variants(name)
    name_query = " OR ".join([f'"{variant}"' for variant in name_variants if variant])

    keyword_query = " OR ".join([f'"{kw}"' for kw in DISRUPTION_KEYWORDS])

    country_key = _normalize_country(country)
    regional_queries: List[str] = []
    for hotspot in REGIONAL_CONFLICT_HOTSPOTS:
        if not _entity_in_hotspot(
            {"country": country_key, "lat": entity.get("lat"), "lng": entity.get("lng")},
            hotspot,
        ):
            continue

        hotspot_terms = " OR ".join(
            [f'"{term}"' for term in hotspot["trigger_terms"]]
        )
        regional_queries.append(f"(({hotspot_terms}) AND ({keyword_query}))")

    regional_query = " OR ".join(regional_queries)

    if name_query and country:
        direct_query = f"(({name_query}) AND ({keyword_query}) AND \"{country}\")"
        if regional_query:
            return f"({direct_query} OR {regional_query})"
        return direct_query
    if name_query:
        direct_query = f"(({name_query}) AND ({keyword_query}))"
        if regional_query:
            return f"({direct_query} OR {regional_query})"
        return direct_query
    if country:
        country_query = f"(\"{country}\" AND ({keyword_query}))"
        if regional_query:
            return f"({country_query} OR {regional_query})"
        return country_query

    if regional_query:
        return f"(({keyword_query}) OR {regional_query})"

    return f"({keyword_query})"


def _matching_hotspots(article: Dict[str, Any], entity: Dict[str, Any]) -> List[str]:
    title = (article.get("title") or "").lower()
    description = (article.get("description") or "").lower()
    content = f"{title} {description}"
    country = _normalize_country(entity.get("country"))

    matches: List[str] = []
    for hotspot in REGIONAL_CONFLICT_HOTSPOTS:
        if not _entity_in_hotspot(
            {"country": country, "lat": entity.get("lat"), "lng": entity.get("lng")},
            hotspot,
        ):
            continue
        if any(term in content for term in hotspot["trigger_terms"]):
            matches.append(hotspot["id"])

    return matches


def _is_disruption_relevant(article: Dict[str, Any], entity: Dict[str, Any]) -> bool:
    title = (article.get("title") or "").lower()
    description = (article.get("description") or "").lower()
    content = f"{title} {description}"

    port_name = _normalize_name(
        entity.get("name")
        or entity.get("port_name")
        or entity.get("location")
        or ""
    ).lower()

    variants = [v.lower() for v in _port_query_variants(port_name)]
    name_match = any(variant and variant in content for variant in variants)
    disruption_match = any(term in content for term in DISRUPTION_KEYWORDS)
    hotspot_match = bool(_matching_hotspots(article, entity))

    return (name_match and disruption_match) or hotspot_match


def compute_news_severity(matched_count: int) -> int:
    # smoother, less saturated than totalResults-based scoring
    return min(matched_count * 20, 100)


async def fetch_news_for_supplier(entity: Dict[str, Any]) -> Dict[str, Any]:
    """
    Kept function name unchanged so the rest of your code still works.
    It now supports port-like entities too.
    """
    api_key = getattr(settings, "NEWS_API_KEY", None)
    if not api_key:
        return {
            "status": "skipped",
            "articles": [],
            "matched_articles": [],
            "totalResults": 0,
            "matchedCount": 0,
            "reason": "NEWS_API_KEY not configured",
        }

    params = {
        "q": build_news_query(entity),
        "language": "en",
        "sortBy": "publishedAt",
        "pageSize": 30,
        "apiKey": api_key,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(NEWS_API_BASE_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    articles: List[Dict[str, Any]] = payload.get("articles", []) or []
    matched_articles = [
        article for article in articles if _is_disruption_relevant(article, entity)
    ]

    payload["matched_articles"] = matched_articles
    payload["matchedCount"] = len(matched_articles)
    return payload


def normalize_news_signal(
    entity: Dict[str, Any],
    api_payload: Dict[str, Any],
) -> Dict[str, Any]:
    matched_articles: List[Dict[str, Any]] = api_payload.get("matched_articles", []) or []
    matched_count = int(api_payload.get("matchedCount", 0) or 0)
    severity = compute_news_severity(matched_count)
    matched_hotspots = sorted(
        {
            hotspot
            for article in matched_articles
            for hotspot in _matching_hotspots(article, entity)
        }
    )

    return {
        "source": "newsapi",
        "entity_type": entity.get("entity_type", "port"),
        "entity_id": str(entity.get("_id") or entity.get("id") or entity.get("name")),
        "port_name": entity.get("port_name") or entity.get("name"),
        "location_name": entity.get("port_name") or entity.get("name") or entity.get("location"),
        "country": entity.get("country"),
        "lat": entity.get("lat"),
        "lng": entity.get("lng"),
        "signal_type": "news_risk",
        "severity": severity,
        "confidence": 0.75 if matched_count > 0 else 0.0,
        "impact_scope": "regional" if matched_hotspots else "port",
        "matched_hotspots": matched_hotspots,
        "article_count": matched_count,
        "keywords": DISRUPTION_KEYWORDS,
        "articles": [
            {
                "title": item.get("title"),
                "source": (item.get("source") or {}).get("name"),
                "published_at": item.get("publishedAt"),
                "url": item.get("url"),
            }
            for item in matched_articles[:10]
        ],
        "event_time": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc),
        "raw_payload": api_payload,
    }
