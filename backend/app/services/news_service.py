from datetime import datetime, timezone
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


def _normalize_name(value: str | None) -> str:
    if not value:
        return ""
    return value.strip()


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

    if name_query and country:
        return f"(({name_query}) AND ({keyword_query}) AND \"{country}\")"
    if name_query:
        return f"(({name_query}) AND ({keyword_query}))"
    if country:
        return f"(\"{country}\" AND ({keyword_query}))"

    return f"({keyword_query})"


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

    return name_match and disruption_match


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

    return {
        "source": "newsapi",
        "entity_type": entity.get("entity_type", "port"),
        "entity_id": str(entity.get("_id") or entity.get("id") or entity.get("name")),
        "port_name": entity.get("port_name") or entity.get("name"),
        "country": entity.get("country"),
        "lat": entity.get("lat"),
        "lng": entity.get("lng"),
        "signal_type": "news_risk",
        "severity": severity,
        "confidence": 0.75 if matched_count > 0 else 0.0,
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