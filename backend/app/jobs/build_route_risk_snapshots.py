import asyncio
from app.services.refresh_service import refresh_route_risk_snapshots


async def main():
    print(await refresh_route_risk_snapshots())


if __name__ == "__main__":
    asyncio.run(main())
