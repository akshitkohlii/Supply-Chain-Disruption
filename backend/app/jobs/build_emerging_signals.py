import asyncio

from app.services.emerging_signal_store_service import build_emerging_signals


async def main():
    result = await build_emerging_signals(limit_per_source=200, save_all=True)
    print(result)


if __name__ == "__main__":
    asyncio.run(main())