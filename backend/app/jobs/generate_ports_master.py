import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.core.database import get_database

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"

# Manual exact coordinates for known ports in your dataset
PORT_COORDINATE_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "Shanghai Port": {
        "country": "China",
        "lat": 31.2304,
        "lng": 121.4737,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
    "Mumbai Port": {
        "country": "India",
        "lat": 18.9497,
        "lng": 72.8406,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
    "Hamburg Port": {
        "country": "Germany",
        "lat": 53.5461,
        "lng": 9.9661,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
    "Rotterdam Port": {
        "country": "Netherlands",
        "lat": 51.9244,
        "lng": 4.4777,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
    "Singapore Port": {
        "country": "Singapore",
        "lat": 1.2644,
        "lng": 103.8405,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
    "Busan Port": {
        "country": "South Korea",
        "lat": 35.1028,
        "lng": 129.0403,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
    "Los Angeles Port": {
        "country": "United States",
        "lat": 33.7361,
        "lng": -118.2631,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
    "Dubai Port": {
        "country": "United Arab Emirates",
        "lat": 25.0657,
        "lng": 55.1713,
        "coordinate_source": "manual_override",
        "coordinate_confidence": "exact",
    },
}

COUNTRY_CODE_MAP = {
    "Japan": "JP",
    "India": "IN",
    "China": "CN",
    "Germany": "DE",
    "United States": "US",
    "USA": "US",
    "Netherlands": "NL",
    "South Korea": "KR",
    "Singapore": "SG",
    "United Arab Emirates": "AE",
    "UAE": "AE",
    "United Kingdom": "GB",
    "UK": "GB",
    "France": "FR",
    "Italy": "IT",
    "Canada": "CA",
    "Australia": "AU",
    "Brazil": "BR",
    "Mexico": "MX",
}


def normalize_str(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def country_code_for(country: Optional[str]) -> Optional[str]:
    if not country:
        return None
    return COUNTRY_CODE_MAP.get(country)


def normalize_port_query(port_name: str) -> str:
    return (
        port_name.replace(" Port", "")
        .replace(" port", "")
        .strip()
    )


async def geocode_port(
    client: httpx.AsyncClient,
    port_name: str,
    country: Optional[str] = None,
) -> Tuple[Optional[float], Optional[float], str, str]:
    normalized_name = normalize_port_query(port_name)
    query = f"{normalized_name}, {country}" if country else normalized_name

    params: Dict[str, Any] = {
        "name": query,
        "count": 5,
        "language": "en",
        "format": "json",
    }

    country_code = country_code_for(country)
    if country_code:
        params["country_code"] = country_code.lower()

    response = await client.get(GEOCODING_URL, params=params, timeout=20.0)
    response.raise_for_status()
    payload = response.json()
    results = payload.get("results", []) or []

    if not results:
        return None, None, "unresolved", "none"

    best = results[0]
    return (
        safe_float(best.get("latitude")),
        safe_float(best.get("longitude")),
        "open_meteo_geocoding",
        "medium" if country else "low",
    )


async def collect_ports_from_shipments() -> Dict[str, Dict[str, Any]]:
    db = get_database()
    docs = await db.shipments_raw.find(
        {},
        {
            "tier1_origin_port": 1,
            "tier2_transit_port": 1,
            "tier3_destination_port": 1,
        },
    ).to_list(length=100000)

    ports: Dict[str, Dict[str, Any]] = {}

    for doc in docs:
        entries = [
            ("origin", normalize_str(doc.get("tier1_origin_port"))),
            ("transit", normalize_str(doc.get("tier2_transit_port"))),
            ("destination", normalize_str(doc.get("tier3_destination_port"))),
        ]

        for role, port_name in entries:
            if not port_name:
                continue

            key = port_name.lower()
            if key not in ports:
                override = PORT_COORDINATE_OVERRIDES.get(port_name, {})
                ports[key] = {
                    "_id": port_name,
                    "port_name": port_name,
                    "country": override.get("country"),
                    "roles": {role},
                    "shipment_count": 1,
                    "lat": override.get("lat"),
                    "lng": override.get("lng"),
                    "coordinate_source": override.get("coordinate_source"),
                    "coordinate_confidence": override.get("coordinate_confidence"),
                }
            else:
                ports[key]["roles"].add(role)
                ports[key]["shipment_count"] += 1

    return ports


async def main():
    db = get_database()
    collected_ports = await collect_ports_from_shipments()

    resolved = 0
    unresolved = 0
    output_docs: List[Dict[str, Any]] = []

    async with httpx.AsyncClient() as client:
        for _, port in collected_ports.items():
            lat = port.get("lat")
            lng = port.get("lng")
            coordinate_source = port.get("coordinate_source", "unresolved")
            coordinate_confidence = port.get("coordinate_confidence", "none")
            country = port.get("country")

            if lat is None or lng is None:
                lat, lng, coordinate_source, coordinate_confidence = await geocode_port(
                    client,
                    port_name=port["port_name"],
                    country=country,
                )

            if lat is not None and lng is not None:
                resolved += 1
            else:
                unresolved += 1

            now = datetime.now(timezone.utc)

            output_docs.append(
                {
                    "_id": port["port_name"],
                    "port_name": port["port_name"],
                    "country": country,
                    "roles": sorted(list(port.get("roles", set()))),
                    "shipment_count": port.get("shipment_count", 0),
                    "lat": lat,
                    "lng": lng,
                    "coordinate_source": coordinate_source,
                    "coordinate_confidence": coordinate_confidence,
                    "active": True,
                    "created_at": now,
                    "updated_at": now,
                }
            )

    await db.ports_master.delete_many({})
    if output_docs:
        await db.ports_master.insert_many(output_docs)

    print(
        {
            "success": True,
            "ports_created": len(output_docs),
            "resolved_coordinates": resolved,
            "unresolved_coordinates": unresolved,
        }
    )


if __name__ == "__main__":
    asyncio.run(main())