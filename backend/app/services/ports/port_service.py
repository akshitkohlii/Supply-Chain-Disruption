from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.core.database import get_database


def _safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or str(value).strip() == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _upsert_port(
    index: Dict[str, Dict[str, Any]],
    port_name: Optional[str],
    country: Optional[str],
    lat: Optional[float],
    lng: Optional[float],
    role: str,
) -> None:
    if not port_name:
        return

    key = port_name.lower()
    item = index.get(key)

    if item is None:
        item = {
            "_id": port_name,
            "port_name": port_name,
            "country": country,
            "lat": lat,
            "lng": lng,
            "roles": {role},
            "shipment_count": 1,
            "active": True,
        }
        index[key] = item
        return

    item["roles"].add(role)
    item["shipment_count"] += 1

    if not item.get("country") and country:
        item["country"] = country
    if item.get("lat") is None and lat is not None:
        item["lat"] = lat
    if item.get("lng") is None and lng is not None:
        item["lng"] = lng


async def get_active_ports() -> List[Dict[str, Any]]:
    db = get_database()
    docs = await db.shipments_raw.find(
        {},
        {
            "origin_port": 1,
            "origin_country": 1,
            "origin_lat": 1,
            "origin_lng": 1,
            "destination_port": 1,
            "destination_country": 1,
            "destination_lat": 1,
            "destination_lng": 1,
            "tier1_origin_port": 1,
            "tier2_transit_port": 1,
            "tier3_destination_port": 1,
            "supplier_country": 1,
        },
    ).to_list(length=100000)

    index: Dict[str, Dict[str, Any]] = {}

    for doc in docs:
        origin_port = _clean_str(doc.get("origin_port") or doc.get("tier1_origin_port"))
        destination_port = _clean_str(doc.get("destination_port") or doc.get("tier3_destination_port"))
        transit_port = _clean_str(doc.get("tier2_transit_port"))

        origin_country = _clean_str(doc.get("origin_country") or doc.get("supplier_country"))
        destination_country = _clean_str(doc.get("destination_country") or doc.get("supplier_country"))

        _upsert_port(
            index,
            origin_port,
            origin_country,
            _safe_float(doc.get("origin_lat")),
            _safe_float(doc.get("origin_lng")),
            "origin",
        )
        _upsert_port(
            index,
            destination_port,
            destination_country,
            _safe_float(doc.get("destination_lat")),
            _safe_float(doc.get("destination_lng")),
            "destination",
        )
        _upsert_port(
            index,
            transit_port,
            origin_country or destination_country,
            None,
            None,
            "transit",
        )

    ports = list(index.values())
    for item in ports:
        item["roles"] = sorted(item["roles"])

    ports.sort(key=lambda item: item.get("shipment_count", 0), reverse=True)
    return ports


async def get_port_by_name(port_name: str) -> Optional[Dict[str, Any]]:
    if not port_name:
        return None

    normalized = port_name.strip().lower()
    for port in await get_active_ports():
        if str(port.get("port_name") or "").strip().lower() == normalized:
            return port

    return None
