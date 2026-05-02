from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from pymongo import ReplaceOne

from app.core.database import get_database
from app.services.dashboard.dashboard_service import clear_dashboard_overview_cache
from app.services.ports.port_service import get_port_by_name

ALERT_THRESHOLD_SETTINGS_ID = "alert-threshold-settings"
DEFAULT_ALERT_THRESHOLDS = {
    "critical_risk_threshold": 70,
    "warning_risk_threshold": 40,
}
ROUTE_ALERT_MIN_RISK = 50
_CACHE_TTL_SECONDS = 20
_alert_cache: dict[str, tuple[datetime, Any]] = {}


def _get_cached(key: str):
    cached = _alert_cache.get(key)
    if not cached:
        return None
    cached_at, value = cached
    if datetime.now(timezone.utc) - cached_at >= timedelta(seconds=_CACHE_TTL_SECONDS):
        _alert_cache.pop(key, None)
        return None
    return value


def _set_cached(key: str, value: Any):
    _alert_cache[key] = (datetime.now(timezone.utc), value)
    return value


def _clear_alert_cache():
    _alert_cache.clear()


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        if value is None:
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _first_present_score(*values: Any) -> int:
    for value in values:
        if value is not None:
            return _safe_int(value)
    return 0


def _clamp_threshold(value: Any, fallback: int) -> int:
    return max(0, min(100, _safe_int(value, fallback)))


def _normalize_alert_thresholds(doc: Optional[Dict[str, Any]] = None) -> Dict[str, int]:
    doc = doc or {}
    return {
        "critical_risk_threshold": _clamp_threshold(
            doc.get("critical_risk_threshold"),
            DEFAULT_ALERT_THRESHOLDS["critical_risk_threshold"],
        ),
        "warning_risk_threshold": _clamp_threshold(
            doc.get("warning_risk_threshold"),
            DEFAULT_ALERT_THRESHOLDS["warning_risk_threshold"],
        ),
    }


def _validate_threshold_order(thresholds: Dict[str, int]) -> Dict[str, int]:
    if thresholds["warning_risk_threshold"] >= thresholds["critical_risk_threshold"]:
        raise ValueError("warning_risk_threshold must be less than critical_risk_threshold")
    return thresholds


def _get_alert_level_from_score(score: int, thresholds: Dict[str, int]) -> str:
    if score >= thresholds["critical_risk_threshold"]:
        return "critical"
    if score >= thresholds["warning_risk_threshold"]:
        return "warning"
    return "stable"


def _calculate_port_combined_risk(scores: Dict[str, Any]) -> int:
    weather = _safe_int(scores.get("weather"))
    news = _safe_int(scores.get("news"))
    congestion = _safe_int(scores.get("congestion"))
    emerging = _safe_int(scores.get("emerging"))

    signal_scores = [weather, news, congestion]
    primary = max(signal_scores, default=0)
    secondary_support = sum(score for score in signal_scores if score != primary)

    if secondary_support == 0 and emerging <= primary:
        return primary

    emerging_support = max(0, emerging - primary) * 0.25
    combined = primary + secondary_support * 0.35 + emerging_support
    return max(primary, min(100, round(combined)))


def _normalize_datetime(value: Any) -> Optional[str]:
    if value is None:
        return None

    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()

    if isinstance(value, str):
        return value

    return str(value)


def _port_name_variants(port_name: Optional[str]) -> List[str]:
    if not port_name:
        return []

    normalized = str(port_name).strip()
    if not normalized:
        return []

    variants = [normalized]
    lower_name = normalized.lower()

    if lower_name.endswith(" port"):
        base = normalized[:-5].strip()
        if base:
            variants.append(base)

    if lower_name.startswith("port of "):
        base = normalized[8:].strip()
        if base:
            variants.append(base)

    return list(dict.fromkeys(variants))


def _serialize_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    scores = doc.get("scores") or {}
    ml_prediction = doc.get("ml_prediction") or {}
    emerging_impact = doc.get("emerging_impact") or {}
    entity_type = str(doc.get("entity_type") or ("route" if doc.get("route_key") else "port"))
    entity_id = str(
        doc.get("entity_id")
        or doc.get("route_key")
        or doc.get("port_name")
        or doc.get("location")
        or ""
    )
    risk_score = _first_present_score(scores.get("final_risk"), doc.get("risk_score"))
    weather_score = _first_present_score(scores.get("weather"), doc.get("weather_score"))
    news_score = _first_present_score(scores.get("news"), doc.get("news_score"))
    logistics_score = _first_present_score(
        scores.get("logistics"),
        doc.get("logistics_score"),
    )
    congestion_score = _first_present_score(
        scores.get("congestion"),
        doc.get("congestion_score"),
    )
    emerging_score = _first_present_score(
        scores.get("emerging"),
        doc.get("emerging_score"),
    )
    final_risk = _first_present_score(scores.get("final_risk"), doc.get("final_risk"))
    ml_score = _first_present_score(scores.get("ml"), doc.get("ml_risk_score"))

    return {
        "_id": str(doc.get("_id")) if doc.get("_id") is not None else None,
        "alert_id": str(doc.get("alert_id") or ""),
        "entity_type": entity_type,
        "entity_id": entity_id,
        "route_key": doc.get("route_key"),
        "title": str(doc.get("title") or "Unknown alert"),
        "location": str(
            doc.get("location")
            or doc.get("destination_port")
            or doc.get("origin_port")
            or "Unknown"
        ),
        "country": doc.get("country"),
        "category": str(doc.get("category") or "logistics"),
        "level": str(doc.get("level") or "stable"),
        "status": str(doc.get("status") or "active"),
        "timestamp": _normalize_datetime(doc.get("timestamp")) or "",
        "summary": str(doc.get("summary") or ""),

        "lat": _safe_float(doc.get("lat")) if doc.get("lat") is not None else None,
        "lng": _safe_float(doc.get("lng")) if doc.get("lng") is not None else None,

        "origin_port": doc.get("origin_port"),
        "destination_port": doc.get("destination_port"),
        "related_origin_port": doc.get("related_origin_port"),
        "related_destination_port": doc.get("related_destination_port"),
        "shipment_id": doc.get("shipment_id"),
        "business_unit": doc.get("business_unit"),
        "supplier_name": doc.get("supplier_name"),

        "risk_score": risk_score,
        "weather_score": weather_score,
        "news_score": news_score,
        "logistics_score": logistics_score,
        "congestion_score": congestion_score,
        "emerging_score": emerging_score,
        "final_risk": final_risk,
        "scores": {
            "weather": weather_score,
            "news": news_score,
            "logistics": logistics_score,
            "congestion": congestion_score,
            "emerging": emerging_score,
            "final_risk": final_risk,
            "ml": ml_score,
        },
        "ml_prediction": {
            "disruption_probability": (
                float(ml_prediction.get("disruption_probability"))
                if ml_prediction.get("disruption_probability") is not None
                else None
            ),
            "ml_risk_score": _safe_int(ml_prediction.get("ml_risk_score")),
            "predicted_delay_hours": (
                _safe_float(ml_prediction.get("predicted_delay_hours"))
                if ml_prediction.get("predicted_delay_hours") is not None
                else None
            ),
            "top_factors": list(ml_prediction.get("top_factors") or []),
        },
        "emerging_impact": {
            "score": _safe_int(emerging_impact.get("score")),
            "top_ports": list(emerging_impact.get("top_ports") or []),
            "signals": [
                {
                    "signal_id": str(signal.get("signal_id") or ""),
                    "source_type": signal.get("source_type"),
                    "risk_type": signal.get("risk_type"),
                    "severity": signal.get("severity"),
                    "port_name": signal.get("port_name"),
                    "emerging_score": _safe_int(signal.get("emerging_score"))
                    if signal.get("emerging_score") is not None
                    else None,
                    "impact_score": _safe_int(signal.get("impact_score")),
                    "title": signal.get("title"),
                }
                for signal in (emerging_impact.get("signals") or [])
            ],
        },
        "top_drivers": list(doc.get("top_drivers") or []),
        "updated_at": _normalize_datetime(doc.get("updated_at")),
    }


def _should_create_alert(route: Dict[str, Any], thresholds: Dict[str, int]) -> bool:
    scores = route.get("scores", {}) or {}
    final_risk = _safe_float(scores.get("final_risk"))
    entity_type = str(route.get("entity_type") or "route")

    if entity_type == "route" and final_risk < ROUTE_ALERT_MIN_RISK:
        return False

    return _get_alert_level_from_score(_safe_int(final_risk), thresholds) != "stable"


def _classify_alert_level(route: Dict[str, Any], thresholds: Dict[str, int]) -> str:
    scores = route.get("scores", {}) or {}
    final_risk = _safe_int(scores.get("final_risk"))
    return _get_alert_level_from_score(final_risk, thresholds)


def _classify_alert_category(route: Dict[str, Any]) -> str:
    scores = route.get("scores", {}) or {}

    weather = _safe_float(scores.get("weather"))
    news = _safe_float(scores.get("news"))
    logistics = _safe_float(scores.get("logistics"))
    congestion = _safe_float(scores.get("congestion"))
    ml = _safe_float(scores.get("ml"))

    if ml >= 55 and ml >= max(weather, news, logistics, congestion):
        return "logistics"

    top_score = max(weather, news, logistics, congestion)

    if top_score == weather:
        return "climate"
    if top_score == news:
        return "geo"
    if top_score == congestion:
        return "port"
    return "logistics"


def _classify_port_alert_category_from_scores(scores: Dict[str, Any]) -> str:
    weather = _safe_float(scores.get("weather"))
    news = _safe_float(scores.get("news"))
    congestion = _safe_float(scores.get("congestion"))
    emerging = _safe_float(scores.get("emerging"))

    top_score = max(weather, news, congestion, emerging)

    if top_score <= 0:
        return "logistics"
    if top_score == weather:
        return "climate"
    if top_score == news:
        return "geo"
    if top_score == congestion:
        return "port"
    return "logistics"


def _build_alert_title(route: Dict[str, Any], category: str) -> str:
    destination_port = route.get("destination_port") or "Unknown destination"
    origin_port = route.get("origin_port") or "Unknown origin"
    supplier_name = route.get("supplier_name") or "Supplier"
    scores = route.get("scores", {}) or {}
    ml = _safe_int(scores.get("ml"))
    top_drivers = list(route.get("top_drivers") or [])

    if "ml" in top_drivers or ml >= 55:
        return f"Route disruption risk on {origin_port} → {destination_port}"

    if category == "climate":
        return f"Weather disruption risk near {destination_port}"
    if category == "geo":
        return f"Geopolitical/news risk affecting {origin_port} → {destination_port}"
    if category == "port":
        return f"Port congestion building at {destination_port}"
    if category == "supplier":
        return f"Supplier risk rising for {supplier_name}"
    return f"Route disruption risk on {origin_port} → {destination_port}"


def _build_alert_summary(route: Dict[str, Any], category: str) -> str:
    scores = route.get("scores", {}) or {}
    ml_prediction = route.get("ml_prediction") or {}
    weather = _safe_int(scores.get("weather"))
    news = _safe_int(scores.get("news"))
    logistics = _safe_int(scores.get("logistics"))
    congestion = _safe_int(scores.get("congestion"))
    ml = _safe_int(scores.get("ml"))
    final_risk = _safe_int(scores.get("final_risk"))
    predicted_delay_hours = ml_prediction.get("predicted_delay_hours")
    top_factors = list(ml_prediction.get("top_factors") or [])

    if ml >= 55:
        delay_text = (
            f" Predicted disruption delay {round(_safe_float(predicted_delay_hours), 1)} hours."
            if predicted_delay_hours is not None
            else ""
        )
        factor_text = f" Key ML factors: {', '.join(top_factors[:3])}." if top_factors else ""
        return (
            f"ML-backed route disruption pressure is elevated. "
            f"ML score {ml}, overall route risk {final_risk}.{delay_text}{factor_text}"
        )

    if category == "climate":
        return f"Elevated weather risk detected. Weather score {weather}, overall route risk {final_risk}."
    if category == "geo":
        return f"External/news-driven disruption signals detected. News score {news}, overall route risk {final_risk}."
    if category == "port":
        return f"Port congestion indicators are rising. Congestion score {congestion}, overall route risk {final_risk}."
    if category == "supplier":
        return f"Supplier-side disruption indicators are elevated. Logistics score {logistics}, overall route risk {final_risk}."

    return (
        f"Combined disruption signals detected across the route. "
        f"Weather {weather}, news {news}, logistics {logistics}, congestion {congestion}, final risk {final_risk}."
    )


async def _get_port_coordinates(port_name: Optional[str]) -> Tuple[Optional[float], Optional[float], Optional[str]]:
    if not port_name:
        return None, None, None

    port = await get_port_by_name(port_name)
    if not port:
        return None, None, None

    lat = port.get("lat")
    lng = port.get("lng")
    country = port.get("country")

    try:
        lat = float(lat) if lat is not None else None
    except (TypeError, ValueError):
        lat = None

    try:
        lng = float(lng) if lng is not None else None
    except (TypeError, ValueError):
        lng = None

    return lat, lng, country


def _build_alert_doc(route: Dict[str, Any], thresholds: Dict[str, int]) -> Dict[str, Any]:
    category = _classify_alert_category(route)
    level = _classify_alert_level(route, thresholds)

    origin_port = route.get("origin_port")
    destination_port = route.get("destination_port")
    route_key = route.get("route_key") or route.get("entity_id")
    scores = route.get("scores", {}) or {}

    return {
        "entity_type": "route",
        "entity_id": route_key,
        "alert_id": str(route_key or f"alert::{destination_port or origin_port or 'unknown'}"),
        "route_key": route_key,
        "title": _build_alert_title(route, category),
        "location": destination_port or origin_port or "Unknown",
        "country": route.get("country"),
        "category": category,
        "level": level,
        "status": "active",
        "timestamp": datetime.now(timezone.utc),
        "summary": _build_alert_summary(route, category),
        "origin_port": origin_port,
        "destination_port": destination_port,
        "business_unit": (
            route.get("business_unit")
            or ((route.get("business_units") or [None])[0])
        ),
        "supplier_name": route.get("supplier_name"),
        "scores": {
            "weather": _safe_int(scores.get("weather")),
            "news": _safe_int(scores.get("news")),
            "logistics": _safe_int(scores.get("logistics")),
            "congestion": _safe_int(scores.get("congestion")),
            "emerging": _safe_int(scores.get("emerging")),
            "ml": _safe_int(scores.get("ml")),
            "final_risk": _safe_int(scores.get("final_risk")),
        },
        "ml_prediction": route.get("ml_prediction") or {},
        "emerging_impact": route.get("emerging_impact") or {},
        "top_drivers": list(route.get("top_drivers") or []),
        "updated_at": route.get("snapshot_time"),
    }


def _emerging_alert_level(signal: Dict[str, Any], thresholds: Dict[str, int]) -> str:
    emerging_score = _safe_int(signal.get("emerging_score") or signal.get("impact_score"))
    return _get_alert_level_from_score(emerging_score, thresholds)


def _emerging_alert_category(signal: Dict[str, Any]) -> str:
    source_type = str(signal.get("source_type") or "")
    risk_type = str(signal.get("risk_type") or "")

    if source_type == "weather" or risk_type == "weather":
        return "climate"
    if source_type == "congestion" or risk_type == "congestion":
        return "port"
    if risk_type == "geo":
        return "geo"
    return "logistics"


def _build_emerging_alert_title(signal: Dict[str, Any]) -> str:
    port_name = signal.get("port_name") or "Unknown port"
    source_type = str(signal.get("source_type") or "")

    if source_type == "congestion":
        return f"Port congestion building at {port_name}"
    if source_type == "weather":
        return f"Weather disruption signal near {port_name}"
    return f"Emerging disruption signal at {port_name}"


def _build_emerging_alert_summary(signal: Dict[str, Any]) -> str:
    source_type = str(signal.get("source_type") or "").capitalize() or "Emerging"
    title = str(signal.get("title") or signal.get("summary") or "Emerging risk signal detected")
    impact_score = _safe_int(signal.get("emerging_score") or signal.get("impact_score"))
    return f"{source_type} signal detected. {title}. Emerging score {impact_score}."


def _build_raw_port_signal_alert_title(signal: Dict[str, Any], source_type: str) -> str:
    port_name = signal.get("port_name") or signal.get("location_name") or "Unknown port"
    if source_type == "congestion":
        return f"Port congestion building at {port_name}"
    if source_type == "weather":
        return f"Weather disruption signal near {port_name}"
    if source_type == "news":
        return f"News pressure rising near {port_name}"
    return f"Port risk signal at {port_name}"


def _build_raw_port_signal_alert_summary(signal: Dict[str, Any], source_type: str) -> str:
    severity = _safe_int(signal.get("severity"))
    description = str(
        signal.get("title")
        or signal.get("summary")
        or signal.get("features", {}).get("weather_description")
        or signal.get("signal_type")
        or "Port risk signal detected"
    )
    source_label = source_type.capitalize()
    return f"{source_label} signal detected. {description}. Severity {severity}."


def _build_port_alert_title_from_scores(port_name: str, category: str) -> str:
    if category == "climate":
        return f"Weather disruption signal near {port_name}"
    if category == "geo":
        return f"News pressure rising near {port_name}"
    if category == "port":
        return f"Port congestion building at {port_name}"
    return f"Port risk signal at {port_name}"


def _build_port_alert_summary_from_scores(
    port_name: str,
    scores: Dict[str, Any],
    category: str,
) -> str:
    weather = _safe_int(scores.get("weather"))
    news = _safe_int(scores.get("news"))
    congestion = _safe_int(scores.get("congestion"))
    emerging = _safe_int(scores.get("emerging"))
    final_risk = _safe_int(scores.get("final_risk"))

    if category == "climate":
        return (
            f"Weather-driven disruption pressure is elevated near {port_name}. "
            f"Weather score {weather}, overall port risk {final_risk}."
        )
    if category == "geo":
        return (
            f"News and geopolitical disruption signals are elevated near {port_name}. "
            f"News score {news}, overall port risk {final_risk}."
        )
    if category == "port":
        return (
            f"Port congestion pressure is elevated near {port_name}. "
            f"Congestion score {congestion}, overall port risk {final_risk}."
        )
    return (
        f"Combined port disruption signals detected near {port_name}. "
        f"Weather {weather}, news {news}, congestion {congestion}, emerging {emerging}, final risk {final_risk}."
    )


def _build_raw_port_signal_alert_doc(
    signal: Dict[str, Any],
    source_type: str,
    thresholds: Dict[str, int],
) -> Dict[str, Any]:
    port_name = signal.get("port_name") or signal.get("location_name") or signal.get("entity_id") or "Unknown port"
    signal_id = str(signal.get("_id") or signal.get("entity_id") or port_name)
    severity = _safe_int(signal.get("severity"))
    category = (
        "port"
        if source_type == "congestion"
        else "climate"
        if source_type == "weather"
        else "geo"
        if source_type == "news"
        else "logistics"
    )
    score_bucket = {
        "weather": severity if source_type == "weather" else 0,
        "news": severity if source_type == "news" else 0,
        "logistics": 0,
        "congestion": severity if source_type == "congestion" else 0,
        "emerging": 0,
        "ml": 0,
        "final_risk": severity,
    }

    return {
        "entity_type": "port",
        "entity_id": port_name,
        "alert_id": f"port-signal::{source_type}::{signal_id}",
        "route_key": None,
        "title": _build_raw_port_signal_alert_title(signal, source_type),
        "location": port_name,
        "country": signal.get("country"),
        "category": category,
        "level": _get_alert_level_from_score(severity, thresholds),
        "status": "active",
        "timestamp": datetime.now(timezone.utc),
        "summary": _build_raw_port_signal_alert_summary(signal, source_type),
        "origin_port": None,
        "destination_port": port_name,
        "business_unit": None,
        "supplier_name": None,
        "scores": score_bucket,
        "ml_prediction": {},
        "emerging_impact": {"score": 0, "top_ports": [port_name], "signals": []},
        "top_drivers": [source_type],
        "lat": _safe_float(signal.get("lat")) if signal.get("lat") is not None else None,
        "lng": _safe_float(signal.get("lng")) if signal.get("lng") is not None else None,
        "updated_at": signal.get("updated_at") or signal.get("fetched_at"),
    }


def _build_emerging_alert_doc(
    signal: Dict[str, Any], thresholds: Dict[str, int]
) -> Dict[str, Any]:
    port_name = signal.get("port_name") or "Unknown port"
    signal_id = str(signal.get("signal_id") or port_name)
    category = _emerging_alert_category(signal)
    level = _emerging_alert_level(signal, thresholds)
    emerging_score = _safe_int(signal.get("emerging_score") or signal.get("impact_score"))

    score_bucket = {
        "weather": emerging_score if str(signal.get("source_type")) == "weather" else 0,
        "news": emerging_score if str(signal.get("source_type")) == "news" else 0,
        "logistics": emerging_score if category == "logistics" else 0,
        "congestion": emerging_score if str(signal.get("source_type")) == "congestion" else 0,
        "emerging": emerging_score,
        "ml": 0,
        "final_risk": emerging_score,
    }

    return {
        "entity_type": "port",
        "entity_id": port_name,
        "alert_id": f"emerging::{signal_id}",
        "route_key": None,
        "title": _build_emerging_alert_title(signal),
        "location": port_name,
        "country": signal.get("country"),
        "category": category,
        "level": level,
        "status": "active",
        "timestamp": datetime.now(timezone.utc),
        "summary": _build_emerging_alert_summary(signal),
        "origin_port": None,
        "destination_port": port_name,
        "business_unit": None,
        "supplier_name": None,
        "scores": score_bucket,
        "ml_prediction": {},
        "emerging_impact": {
            "score": emerging_score,
            "top_ports": [port_name],
            "signals": [
                {
                    "signal_id": signal_id,
                    "source_type": signal.get("source_type"),
                    "risk_type": signal.get("risk_type"),
                    "severity": signal.get("severity"),
                    "port_name": port_name,
                    "emerging_score": emerging_score,
                    "impact_score": _safe_int(signal.get("impact_score") or emerging_score),
                    "title": signal.get("title"),
                }
            ],
        },
        "top_drivers": [str(signal.get("source_type") or "emerging"), "emerging"],
        "lat": _safe_float(signal.get("lat")) if signal.get("lat") is not None else None,
        "lng": _safe_float(signal.get("lng")) if signal.get("lng") is not None else None,
        "updated_at": signal.get("updated_at") or signal.get("created_at"),
    }


async def _latest_port_signal_scores(port_name: Optional[str]) -> Dict[str, int]:
    if not port_name:
        return {"weather": 0, "news": 0, "congestion": 0}

    db = get_database()
    variants = _port_name_variants(port_name)
    query = {
        "$or": [
            {"entity_id": {"$in": variants}},
            {"port_name": {"$in": variants}},
            {"location_name": {"$in": variants}},
        ]
    }

    weather_doc = await db.weather_signals.find_one(query, sort=[("fetched_at", -1)])
    news_doc = await db.news_signals.find_one(query, sort=[("fetched_at", -1)])
    congestion_doc = await db.port_congestion_signals.find_one(query, sort=[("fetched_at", -1)])

    return {
        "weather": _safe_int((weather_doc or {}).get("severity")),
        "news": _safe_int((news_doc or {}).get("severity")),
        "congestion": _safe_int((congestion_doc or {}).get("severity")),
    }


async def _latest_port_emerging_impact(port_name: Optional[str]) -> Dict[str, Any]:
    if not port_name:
        return {"score": 0, "top_ports": [], "signals": []}

    db = get_database()
    variants = _port_name_variants(port_name)
    query = {
        "is_relevant": True,
        "$or": [
            {"port_name": {"$in": variants}},
            {"location_name": {"$in": variants}},
            {"entity_id": {"$in": variants}},
        ],
    }

    docs = (
        await db.emerging_signals.find(query)
        .sort([("emerging_score", -1), ("updated_at", -1), ("created_at", -1)])
        .to_list(length=3)
    )

    if not docs:
        return {"score": 0, "top_ports": [port_name], "signals": []}

    signals = []
    top_score = 0
    for doc in docs:
        emerging_score = _safe_int(doc.get("emerging_score") or doc.get("impact_score"))
        impact_score = _safe_int(doc.get("impact_score") or doc.get("emerging_score"))
        top_score = max(top_score, emerging_score, impact_score)
        signals.append(
            {
                "signal_id": str(doc.get("signal_id") or doc.get("_id") or ""),
                "source_type": doc.get("source_type"),
                "risk_type": doc.get("risk_type"),
                "severity": doc.get("severity"),
                "port_name": doc.get("port_name") or port_name,
                "emerging_score": emerging_score,
                "impact_score": impact_score,
                "title": doc.get("title"),
            }
        )

    return {
        "score": top_score,
        "top_ports": [port_name],
        "signals": signals,
    }


async def _enrich_port_alert_doc(
    alert_doc: Dict[str, Any], thresholds: Dict[str, int]
) -> Dict[str, Any]:
    port_name = alert_doc.get("destination_port") or alert_doc.get("location")
    if not port_name:
        return alert_doc

    db = get_database()
    latest_scores = await _latest_port_signal_scores(port_name)
    emerging_impact = await _latest_port_emerging_impact(port_name)
    scores = dict(alert_doc.get("scores") or {})
    scores["weather"] = max(_safe_int(scores.get("weather")), latest_scores["weather"])
    scores["news"] = max(_safe_int(scores.get("news")), latest_scores["news"])
    scores["congestion"] = max(_safe_int(scores.get("congestion")), latest_scores["congestion"])
    scores["emerging"] = max(
        _safe_int(scores.get("emerging")),
        _safe_int(emerging_impact.get("score")),
    )
    scores["final_risk"] = _calculate_port_combined_risk(scores)
    alert_doc["scores"] = scores
    alert_doc["weather_score"] = scores["weather"]
    alert_doc["news_score"] = scores["news"]
    alert_doc["congestion_score"] = scores["congestion"]
    alert_doc["emerging_score"] = scores["emerging"]
    alert_doc["final_risk"] = scores["final_risk"]
    alert_doc["level"] = _get_alert_level_from_score(scores["final_risk"], thresholds)
    alert_doc["emerging_impact"] = emerging_impact

    category = _classify_port_alert_category_from_scores(scores)
    alert_doc["category"] = category
    alert_doc["title"] = _build_port_alert_title_from_scores(str(port_name), category)
    alert_doc["summary"] = _build_port_alert_summary_from_scores(
        str(port_name),
        scores,
        category,
    )

    top_drivers = list(alert_doc.get("top_drivers") or [])
    if scores["weather"] > 0 and "weather" not in top_drivers:
        top_drivers.append("weather")
    if scores["news"] > 0 and "news" not in top_drivers:
        top_drivers.append("news")
    if scores["congestion"] > 0 and "congestion" not in top_drivers:
        top_drivers.append("congestion")
    alert_doc["top_drivers"] = top_drivers[:4]

    related_snapshot = await db.risk_snapshots.find_one(
        {
            "entity_type": "route",
            "$or": [
                {"origin_port": port_name},
                {"destination_port": port_name},
            ],
        },
        sort=[("snapshot_time", -1), ("scores.final_risk", -1)],
    )

    if related_snapshot:
        alert_doc["related_origin_port"] = related_snapshot.get("origin_port")
        alert_doc["related_destination_port"] = related_snapshot.get("destination_port")

        related_route_key = related_snapshot.get("route_key") or related_snapshot.get("entity_id")
        shipment_query: Dict[str, Any] = {}
        if related_route_key:
            shipment_query["route_key"] = related_route_key
        else:
            shipment_query = {
                "origin_port": related_snapshot.get("origin_port"),
                "destination_port": related_snapshot.get("destination_port"),
            }

        latest_shipment = await db.shipments_raw.find_one(
            shipment_query,
            sort=[("timestamp", -1)],
        )
        if latest_shipment:
            alert_doc["shipment_id"] = latest_shipment.get("shipment_id")

    return alert_doc


async def get_alert_threshold_settings() -> Dict[str, int]:
    db = get_database()
    doc = await db.app_settings.find_one({"_id": ALERT_THRESHOLD_SETTINGS_ID})
    return _normalize_alert_thresholds(doc)


async def update_alert_threshold_settings(
    critical_risk_threshold: int,
    warning_risk_threshold: int,
    regenerate_alerts: bool = True,
) -> Dict[str, Any]:
    db = get_database()
    normalized = _validate_threshold_order(
        _normalize_alert_thresholds(
            {
                "critical_risk_threshold": critical_risk_threshold,
                "warning_risk_threshold": warning_risk_threshold,
            }
        )
    )

    await db.app_settings.update_one(
        {"_id": ALERT_THRESHOLD_SETTINGS_ID},
        {
            "$set": {
                **normalized,
                "updated_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )

    generation_result = None
    if regenerate_alerts:
        generation_result = await generate_alerts_from_snapshots(thresholds=normalized)
    else:
        _clear_alert_cache()

    return {
        **normalized,
        "regenerate_alerts": regenerate_alerts,
        "generation_result": generation_result,
    }


async def generate_alerts_from_snapshots(
    thresholds: Optional[Dict[str, int]] = None,
) -> Dict[str, Any]:
    db = get_database()
    thresholds = _validate_threshold_order(
        thresholds or await get_alert_threshold_settings()
    )

    routes = (
        await db.risk_snapshots.find({"entity_type": "route"})
        .sort("snapshot_time", -1)
        .to_list(length=5000)
    )

    latest_by_route: Dict[str, Dict[str, Any]] = {}
    for route in routes:
        route_key = route.get("route_key") or route.get("entity_id")
        if route_key and route_key not in latest_by_route:
            latest_by_route[route_key] = route

    processed_route_keys = list(latest_by_route.keys())

    inserted = 0
    skipped = 0
    alert_docs: List[Dict[str, Any]] = []
    alert_ids: List[str] = []

    for _, route in latest_by_route.items():
        if not _should_create_alert(route, thresholds):
            skipped += 1
            continue

        alert_doc = _build_alert_doc(route, thresholds)

        preferred_port = route.get("destination_port") or route.get("origin_port")
        lat, lng, country = await _get_port_coordinates(preferred_port)

        if lat is not None:
            alert_doc["lat"] = lat
        if lng is not None:
            alert_doc["lng"] = lng
        if country:
            alert_doc["country"] = country

        alert_docs.append(alert_doc)
        alert_ids.append(str(alert_doc["alert_id"]))
        inserted += 1

    emerging_signals = (
        await db.emerging_signals.find(
            {
                "is_relevant": True,
                "severity": {"$in": ["medium", "high"]},
            }
        )
        .sort([("emerging_score", -1), ("updated_at", -1)])
        .to_list(length=5000)
    )

    latest_by_port_source: Dict[str, Dict[str, Any]] = {}
    for signal in emerging_signals:
        port_name = str(signal.get("port_name") or "")
        source_type = str(signal.get("source_type") or "")
        if not port_name or not source_type:
            continue
        key = f"{port_name}|{source_type}"
        if key not in latest_by_port_source:
            latest_by_port_source[key] = signal

    for signal in latest_by_port_source.values():
        alert_doc = _build_emerging_alert_doc(signal, thresholds)
        alert_doc = await _enrich_port_alert_doc(alert_doc, thresholds)
        if alert_doc.get("level") == "stable":
            skipped += 1
            continue
        alert_docs.append(alert_doc)
        alert_ids.append(str(alert_doc["alert_id"]))
        inserted += 1

    existing_port_source_keys = set(latest_by_port_source.keys())
    for collection_name, source_type in [
        ("port_congestion_signals", "congestion"),
        ("news_signals", "news"),
        ("weather_signals", "weather"),
    ]:
        docs = (
            await db[collection_name].find({})
            .sort([("fetched_at", -1), ("severity", -1)])
            .to_list(length=5000)
        )

        latest_raw_by_port: Dict[str, Dict[str, Any]] = {}
        for doc in docs:
            port_name = str(doc.get("port_name") or doc.get("location_name") or doc.get("entity_id") or "")
            if not port_name:
                continue
            key = f"{port_name}|{source_type}"
            if key in existing_port_source_keys:
                continue
            if key not in latest_raw_by_port:
                latest_raw_by_port[key] = doc

        for doc in latest_raw_by_port.values():
            alert_doc = _build_raw_port_signal_alert_doc(doc, source_type, thresholds)
            alert_doc = await _enrich_port_alert_doc(alert_doc, thresholds)
            if alert_doc.get("level") == "stable":
                skipped += 1
                continue
            alert_docs.append(alert_doc)
            alert_ids.append(str(alert_doc["alert_id"]))
            inserted += 1

    if alert_docs:
        await db.alerts.bulk_write(
            [
                ReplaceOne({"alert_id": doc["alert_id"]}, doc, upsert=True)
                for doc in alert_docs
            ],
            ordered=False,
        )

    stale_filter = {"alert_id": {"$nin": alert_ids}} if alert_ids else {}
    await db.alerts.delete_many(stale_filter)

    _clear_alert_cache()
    clear_dashboard_overview_cache()

    return {
        "success": True,
        "routes_evaluated": len(processed_route_keys),
        "alerts_upserted": inserted,
        "skipped": skipped,
        "critical_risk_threshold": thresholds["critical_risk_threshold"],
        "warning_risk_threshold": thresholds["warning_risk_threshold"],
    }


async def list_alerts(limit: int = 50) -> List[Dict[str, Any]]:
    cache_key = f"list:{limit}"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    db = get_database()
    docs = (
        await db.alerts.find({})
        .sort("timestamp", -1)
        .limit(limit)
        .to_list(length=limit)
    )
    return _set_cached(cache_key, [_serialize_doc(doc) for doc in docs])


async def get_alert_summary() -> Dict[str, Any]:
    cache_key = "summary"
    cached = _get_cached(cache_key)
    if cached is not None:
        return cached

    db = get_database()
    alerts = await db.alerts.find({}).to_list(length=5000)
    active_alerts_only = [alert for alert in alerts if alert.get("status") == "active"]

    total_alerts = len(alerts)
    active_alerts = len(active_alerts_only)
    critical_alerts = sum(1 for a in active_alerts_only if a.get("level") == "critical")
    warning_alerts = sum(1 for a in active_alerts_only if a.get("level") == "warning")

    category_counts: Dict[str, int] = {}
    for alert in active_alerts_only:
        category = alert.get("category", "unknown")
        category_counts[category] = category_counts.get(category, 0) + 1

    top_category = (
        max(category_counts.items(), key=lambda x: x[1])[0]
        if category_counts
        else "none"
    )

    return _set_cached(cache_key, {
        "total_alerts": total_alerts,
        "active_alerts": active_alerts,
        "critical_alerts": critical_alerts,
        "warning_alerts": warning_alerts,
        "top_category": top_category,
    })


async def update_alert_status(alert_id: str, status: str) -> Dict[str, Any]:
    db = get_database()

    result = await db.alerts.update_one(
        {"alert_id": alert_id},
        {
            "$set": {
                "status": status,
                "updated_at": datetime.now(timezone.utc),
            }
        },
    )
    if result.matched_count == 0:
        raise LookupError(f"Alert not found: {alert_id}")

    _clear_alert_cache()
    clear_dashboard_overview_cache()

    return {
        "message": "Alert status updated successfully",
        "alert_id": alert_id,
        "status": status,
    }
