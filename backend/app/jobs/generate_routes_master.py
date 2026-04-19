import asyncio

from app.services.refresh_service import refresh_routes_master


async def main():
    print(await refresh_routes_master())


if __name__ == "__main__":
    asyncio.run(main())
