import asyncio

from app.services.port_congestion_service import ingest_port_congestion_signals


async def main():
    result = await ingest_port_congestion_signals()
    print(result)


if __name__ == "__main__":
    asyncio.run(main())