import asyncio
from app.core.database import db

PORT_COORDINATES = {
    "Los Angeles Port": {"lat": 33.7405, "lng": -118.2719, "country": "USA", "region": "North America"},
    "Shanghai Port": {"lat": 31.2304, "lng": 121.4737, "country": "China", "region": "Asia"},
    "Hamburg Port": {"lat": 53.5461, "lng": 9.9661, "country": "Germany", "region": "Europe"},
    "Mumbai Port": {"lat": 18.9543, "lng": 72.8496, "country": "India", "region": "Asia"},
    "Busan Port": {"lat": 35.1028, "lng": 129.0403, "country": "South Korea", "region": "Asia"},
}


async def build_ports_master():
    await db.ports_master.delete_many({})
    print("Cleared old ports_master")

    unique_ports = set()

    cursor = db.shipments_raw.find(
        {},
        {
            "tier1_origin_port": 1,
            "tier2_transit_port": 1,
            "tier3_destination_port": 1,
        },
    )

    shipments = await cursor.to_list(length=None)

    for item in shipments:
        if item.get("tier1_origin_port"):
            unique_ports.add(item["tier1_origin_port"])
        if item.get("tier2_transit_port"):
            unique_ports.add(item["tier2_transit_port"])
        if item.get("tier3_destination_port"):
            unique_ports.add(item["tier3_destination_port"])

    port_docs = []
    for port_name in unique_ports:
        details = PORT_COORDINATES.get(
            port_name,
            {"lat": 0.0, "lng": 0.0, "country": "Unknown", "region": "Unknown"},
        )

        port_docs.append({
            "port_name": port_name,
            "lat": details["lat"],
            "lng": details["lng"],
            "country": details["country"],
            "region": details["region"],
        })

    if port_docs:
        await db.ports_master.insert_many(port_docs)

    print(f"Inserted {len(port_docs)} ports into ports_master")


if __name__ == "__main__":
    asyncio.run(build_ports_master())