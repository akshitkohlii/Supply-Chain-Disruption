from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any, Dict, List

import httpx

from app.core.config import settings
from app.services.ml.news_relevance_model_service import predict_news_relevance

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

QUERY_DISRUPTION_KEYWORDS = [
    "strike",
    "congestion",
    "shutdown",
    "blockade",
    "closure",
    "customs",
]

STRONG_DISRUPTION_TERMS = [
    "strike",
    "shutdown",
    "blockade",
    "closure",
    "closed",
    "halt",
    "suspended",
    "sanction",
    "conflict",
    "war",
    "attack",
    "explosion",
    "cyberattack",
]

PORT_CONTEXT_TERMS = [
    "port",
    "terminal",
    "harbor",
    "harbour",
    "vessel",
    "shipping",
    "maritime",
    "container",
    "customs",
    "cargo",
    "berth",
    "canal",
    "freight",
]

WEAK_CONTEXT_TERMS = [
    "economy",
    "markets",
    "stock",
    "election",
    "festival",
    "celebrity",
    "sports",
    "tourism",
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

    keyword_query = " OR ".join([f'"{kw}"' for kw in QUERY_DISRUPTION_KEYWORDS])

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


def _article_text(article: Dict[str, Any]) -> str:
    title = (article.get("title") or "").lower()
    description = (article.get("description") or "").lower()
    return f"{title} {description}".strip()


def _term_hits(content: str, terms: List[str]) -> int:
    return sum(1 for term in terms if term in content)


def _published_age_hours(article: Dict[str, Any]) -> float:
    published_at = article.get("publishedAt")
    if not published_at or not isinstance(published_at, str):
        return 72.0

    try:
        parsed = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return max(
            0.0,
            round((datetime.now(timezone.utc) - parsed).total_seconds() / 3600.0, 2),
        )
    except ValueError:
        return 72.0


def _news_article_features(article: Dict[str, Any], entity: Dict[str, Any]) -> Dict[str, Any]:
    content = _article_text(article)
    title = (article.get("title") or "").lower()
    port_name = _normalize_name(
        entity.get("name")
        or entity.get("port_name")
        or entity.get("location")
        or ""
    ).lower()
    country = _normalize_country(entity.get("country"))

    variants = [v.lower() for v in _port_query_variants(port_name)]
    exact_port_match = any(variant and variant in title for variant in variants)
    name_match = any(variant and variant in content for variant in variants)
    country_match = bool(country and country in content)
    disruption_hits = _term_hits(content, DISRUPTION_KEYWORDS)
    strong_hits = _term_hits(content, STRONG_DISRUPTION_TERMS)
    port_context_hits = _term_hits(content, PORT_CONTEXT_TERMS)
    weak_context_hits = _term_hits(content, WEAK_CONTEXT_TERMS)
    hotspot_matches = _matching_hotspots(article, entity)
    hotspot_match = bool(hotspot_matches)
    published_age_hours = _published_age_hours(article)
    recency_bonus = max(0.0, 24.0 - min(24.0, published_age_hours / 2.0))

    score = 0.0
    if exact_port_match:
        score += 4.0
    elif name_match:
        score += 3.0
    elif country_match:
        score += 0.35

    score += min(2.5, disruption_hits * 0.55)
    score += min(2.5, strong_hits * 1.0)
    score += min(3.2, port_context_hits * 0.9)
    if hotspot_match:
        score += 2.0
    score += recency_bonus / 8.0
    score -= min(3.0, weak_context_hits * 1.0)

    # Country-only mentions should not become disruption signals unless the
    # article also has clear logistics/port context and strong disruption cues.
    hard_relevant = (
        exact_port_match
        or (
            name_match
            and port_context_hits >= 1
            and (strong_hits >= 1 or disruption_hits >= 2)
        )
        or (
            hotspot_match
            and (
                strong_hits >= 1
                or (disruption_hits >= 2 and port_context_hits >= 1)
            )
        )
        or (
            country_match
            and strong_hits >= 1
            and port_context_hits >= 2
            and disruption_hits >= 2
        )
    )

    return {
        "title": article.get("title") or "",
        "summary": article.get("description") or "",
        "port_name": entity.get("port_name") or entity.get("name") or "",
        "country": entity.get("country") or "",
        "content": content,
        "name_match": name_match,
        "country_match": country_match,
        "exact_port_match": exact_port_match,
        "disruption_hits": disruption_hits,
        "strong_hits": strong_hits,
        "port_context_hits": port_context_hits,
        "weak_context_hits": weak_context_hits,
        "hotspot_matches": hotspot_matches,
        "hotspot_match": hotspot_match,
        "published_age_hours": published_age_hours,
        "score": round(score, 2),
        "hard_relevant": hard_relevant,
    }


def _is_disruption_relevant(article: Dict[str, Any], entity: Dict[str, Any]) -> bool:
    features = _news_article_features(article, entity)
    has_strong_entity_context = bool(
        features["exact_port_match"]
        or (
            features["name_match"]
            and features["port_context_hits"] >= 1
        )
        or (
            features["hotspot_match"]
            and features["strong_hits"] >= 1
        )
    )
    prediction = predict_news_relevance(features)
    if prediction:
        return bool(
            prediction["is_relevant"]
            and (
                has_strong_entity_context
                or (
                    features["country_match"]
                    and features["port_context_hits"] >= 2
                    and features["strong_hits"] >= 1
                )
            )
        )
    return features["hard_relevant"] and features["score"] >= 6.5


def compute_news_severity(matched_count: int, weighted_score: float = 0.0) -> int:
    count_component = min(matched_count * 14, 42)
    score_component = min(weighted_score * 8, 58)
    return min(100, round(count_component + score_component))


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
    article_features = [
        _news_article_features(article, entity) for article in matched_articles
    ]
    weighted_score = round(
        sum(float(item.get("score", 0.0) or 0.0) for item in article_features[:5]),
        2,
    )
    severity = compute_news_severity(matched_count, weighted_score)
    matched_hotspots = sorted(
        {
            hotspot
            for article in matched_articles
            for hotspot in _matching_hotspots(article, entity)
        }
    )
    avg_age_hours = round(
        (
            sum(float(item.get("published_age_hours", 72.0) or 72.0) for item in article_features)
            / matched_count
        ),
        2,
    ) if matched_count else 72.0
    keyword_hits = sum(int(item.get("disruption_hits", 0) or 0) for item in article_features)
    strong_hits = sum(int(item.get("strong_hits", 0) or 0) for item in article_features)
    port_context_hits = sum(int(item.get("port_context_hits", 0) or 0) for item in article_features)
    exact_port_mentions = sum(1 for item in article_features if item.get("exact_port_match"))
    hotspot_article_count = sum(1 for item in article_features if item.get("hotspot_match"))
    weak_context_hits = sum(int(item.get("weak_context_hits", 0) or 0) for item in article_features)
    sentiment_score = round(
        -min(1.0, (strong_hits * 0.22) + (keyword_hits * 0.05) - (weak_context_hits * 0.08)),
        3,
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
        "features": {
            "keyword_hits": keyword_hits,
            "strong_disruption_hits": strong_hits,
            "port_context_hits": port_context_hits,
            "exact_port_mentions": exact_port_mentions,
            "hotspot_article_count": hotspot_article_count,
            "contains_disruption_terms": 1 if keyword_hits > 0 else 0,
            "published_age_hours": avg_age_hours,
            "sentiment_score": sentiment_score,
            "relevance_score": weighted_score,
        },
        "keywords": DISRUPTION_KEYWORDS,
        "articles": [
            {
                "title": item.get("title"),
                "source": (item.get("source") or {}).get("name"),
                "published_at": item.get("publishedAt"),
                "url": item.get("url"),
                "relevance_score": article_features[index]["score"] if index < len(article_features) else None,
            }
            for index, item in enumerate(matched_articles[:10])
        ],
        "event_time": datetime.now(timezone.utc),
        "fetched_at": datetime.now(timezone.utc),
        "raw_payload": api_payload,
    }
