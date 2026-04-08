import asyncio

from app.services.signal_service import ingest_news_signals_for_all_ports


async def main():
    summary = await ingest_news_signals_for_all_ports()
    print("News ingestion summary:")
    print(summary)


if __name__ == "__main__":
    asyncio.run(main())