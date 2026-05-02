import asyncio

from app.services.alerts.alert_service import generate_alerts_from_snapshots


async def generate_alerts():
    result = await generate_alerts_from_snapshots()
    print(result)


if __name__ == "__main__":
    asyncio.run(generate_alerts())
