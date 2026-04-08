import asyncio

from app.services.signal_service import ingest_weather_signals_for_all_ports


async def main():
    summary = await ingest_weather_signals_for_all_ports()
    print("Weather ingestion summary:")
    print(summary)


if __name__ == "__main__":
    asyncio.run(main())