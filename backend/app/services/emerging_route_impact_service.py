from typing import Any, Dict, List

from app.core.database import get_database


def clamp_score(value: float) -> int:
    return max(0, min(100, round(value)))


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _source_weight(source_type: str) -> float:
    if source_type == "news":
        return 1.0
    if source_type == "weather":
        return 0.9
    if source_type == "congestion":
        return 0.95
    return 0.75


def _severity_weight(severity: str) -> float:
    if severity == "high":
        return 1.0
    if severity == "medium":
        return 0.65
    return 0.35


def _risk_type_weight(risk_type: str) -> float:
    if risk_type in {"geo", "logistics", "congestion", "weather"}:
        return 1.0
    return 0.8


def compute_signal_impact(signal: Dict[str, Any]) -> int:
    base = _safe_float(signal.get("emerging_score"), 0)
    relevance_prob = _safe_float(signal.get("relevance_probability"), 0)
    source_type = str(signal.get("source_type") or "")
    severity = str(signal.get("severity") or "low")
    risk_type = str(signal.get("risk_type") or "mixed")

    weighted = (
        base
        * _source_weight(source_type)
        * _severity_weight(severity)
        * _risk_type_weight(risk_type)
        * (0.75 + relevance_prob * 0.25)
    )

    return clamp_score(weighted * 0.35)


async def get_route_emerging_impact(route_doc: Dict[str, Any]) -> Dict[str, Any]:
    db = get_database()

    origin_port = route_doc.get("origin_port")
    destination_port = route_doc.get("destination_port")

    relevant_signals = await db.emerging_signals.find(
        {
            "is_relevant": True,
            "port_name": {"$in": [origin_port, destination_port]},
        }
    ).sort([("emerging_score", -1), ("updated_at", -1)]).to_list(length=50)

    if not relevant_signals:
        return {
            "score": 0,
            "signals": [],
            "top_ports": [],
        }

    impacts: List[Dict[str, Any]] = []
    total = 0.0

    for signal in relevant_signals:
        impact_score = compute_signal_impact(signal)
        if impact_score <= 0:
            continue

        impacts.append(
            {
                "signal_id": signal.get("signal_id"),
                "source_type": signal.get("source_type"),
                "risk_type": signal.get("risk_type"),
                "severity": signal.get("severity"),
                "port_name": signal.get("port_name"),
                "emerging_score": signal.get("emerging_score"),
                "impact_score": impact_score,
                "title": signal.get("title"),
            }
        )
        total += impact_score

    impacts.sort(key=lambda x: x["impact_score"], reverse=True)

    combined = clamp_score(min(100.0, total))
    top_ports = list(
        dict.fromkeys(
            [item["port_name"] for item in impacts if item.get("port_name")]
        )
    )

    return {
        "score": combined,
        "signals": impacts[:5],
        "top_ports": top_ports[:3],
    }