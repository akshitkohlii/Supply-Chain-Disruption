import asyncio
from datetime import datetime, timezone

from app.core.database import get_database
from app.services.supplier_service import predict_supplier_disruption


async def main():
    db = get_database()

    supplier_ids = await db.shipments_raw.distinct("supplier_id")

    await db.supplier_predictions.delete_many({})

    inserted = 0
    skipped = 0

    for supplier_id in supplier_ids:
        if not supplier_id:
            continue

        try:
            prediction = await predict_supplier_disruption(supplier_id)

            doc = {
                **prediction,
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }

            await db.supplier_predictions.insert_one(doc)
            inserted += 1
        except Exception as exc:
            skipped += 1
            print(f"Skipped {supplier_id}: {exc}")

    print(
        {
            "success": True,
            "suppliers_processed": len(supplier_ids),
            "inserted": inserted,
            "skipped": skipped,
        }
    )


if __name__ == "__main__":
    asyncio.run(main())
