import asyncio

from app.core.database import db
from app.services.port_lookup import find_port, load_ports_df


def pick_best_country(item: dict) -> str | None:
    return (
        item.get("destination_country")
        or item.get("origin_country")
        or item.get("supplier_country")
        or item.get("country")
    )


async def build_ports_master():
    load_ports_df.cache_clear()

    await db.ports_master.delete_many({})
    print("Cleared old ports_master")

    unique_ports: dict[str, dict] = {}

    cursor = db.shipments_raw.find(
        {},
        {
            "tier1_origin_port": 1,
            "tier2_transit_port": 1,
            "tier3_destination_port": 1,
            "origin_country": 1,
            "destination_country": 1,
            "supplier_country": 1,
            "country": 1,
        },
    )

    shipments = await cursor.to_list(length=None)

    for item in shipments:
        fallback_country = pick_best_country(item)

        port_candidates = [
            item.get("tier1_origin_port"),
            item.get("tier2_transit_port"),
            item.get("tier3_destination_port"),
        ]

        for port_name in port_candidates:
            if not port_name or not str(port_name).strip():
                continue

            key = str(port_name).strip().lower()
            if key not in unique_ports:
                unique_ports[key] = {
                    "port_name": str(port_name).strip(),  # raw shipment value
                    "country": fallback_country,
                }

    port_docs = []
    matched_count = 0
    unmatched_count = 0

    for _, port_info in unique_ports.items():
        port_name = port_info["port_name"]
        country = port_info.get("country")

        resolved = find_port(port_name, country)

        if resolved:
            matched_count += 1
            port_docs.append(
                {
                    "port_name": port_name,  # keep raw name for joins
                    "resolved_port_name": resolved["port_name"],  # canonical CSV name
                    "port_key": resolved["port_key"],
                    "port_id": resolved["port_id"],
                    "country": resolved["country"],
                    "lat": resolved["latitude"],
                    "lng": resolved["longitude"],
                    "harbor_size": resolved["harbor_size"],
                    "harbor_type": resolved["harbor_type"],
                    "max_vessel": resolved["max_vessel"],
                    "match_status": "matched",
                }
            )
        else:
            unmatched_count += 1
            print(f"UNMATCHED PORT: {port_name!r} | country={country!r}")
            port_docs.append(
                {
                    "port_name": port_name,
                    "resolved_port_name": None,
                    "port_key": None,
                    "port_id": None,
                    "country": country or "Unknown",
                    "lat": None,
                    "lng": None,
                    "harbor_size": None,
                    "harbor_type": None,
                    "max_vessel": None,
                    "match_status": "unmatched",
                }
            )

    if port_docs:
        await db.ports_master.insert_many(port_docs)

    print(f"Inserted {len(port_docs)} ports into ports_master")
    print(f"Matched: {matched_count}")
    print(f"Unmatched: {unmatched_count}")


if __name__ == "__main__":
    asyncio.run(build_ports_master())