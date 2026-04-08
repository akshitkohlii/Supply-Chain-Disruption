from app.core.database import get_database


def _band(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


async def get_suppliers_overview():
    db = get_database()

    total_suppliers = len(await db.shipments_raw.distinct("supplier_id"))

    pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "supplier_name": {"$first": "$supplier_name"},
                "supplier_country": {"$first": "$supplier_country"},
                "supplier_region": {"$first": "$supplier_region"},
                "avg_delay_hours": {"$avg": {"$ifNull": ["$delay_hours", 0]}},
                "avg_inventory_level": {"$avg": {"$ifNull": ["$inventory_level", 0]}},
                "avg_customs_clearance_hours": {
                    "$avg": {"$ifNull": ["$customs_clearance_hours", 0]}
                },
                "avg_demand_volatility": {
                    "$avg": {"$ifNull": ["$demand_volatility", 0]}
                },
                "avg_order_value": {"$avg": {"$ifNull": ["$order_value", 0]}},
                "shipment_count": {"$sum": 1},
            }
        }
    ]

    rows = await db.shipments_raw.aggregate(pipeline).to_list(length=5000)

    suppliers = []
    for row in rows:
        avg_delay = float(row.get("avg_delay_hours") or 0)
        avg_inventory = float(row.get("avg_inventory_level") or 0)
        avg_customs = float(row.get("avg_customs_clearance_hours") or 0)
        avg_volatility = float(row.get("avg_demand_volatility") or 0)
        shipment_count = int(row.get("shipment_count") or 0)

        risk_score = min(
            100.0,
            (avg_delay * 1.8)
            + (avg_customs * 0.9)
            + max(0.0, (1 - min(avg_inventory / 1000.0, 1.0)) * 22)
            + (avg_volatility * 35),
        )

        dependency_score = min(
            100.0,
            (shipment_count / 300.0) * 70 + (avg_customs / 48.0) * 30,
        )

        suppliers.append(
            {
                "supplier_id": str(row.get("_id")),
                "supplier_name": row.get("supplier_name") or str(row.get("_id")),
                "supplier_country": row.get("supplier_country") or "Unknown",
                "supplier_region": row.get("supplier_region") or "Unknown",
                "avg_delay_hours": round(avg_delay, 2),
                "avg_inventory_level": round(avg_inventory, 2),
                "avg_lead_time": round(avg_customs, 2),
                "shipment_count": shipment_count,
                "risk_score": round(risk_score, 2),
                "dependency_score": round(dependency_score, 2),
                "risk_band": _band(risk_score),
            }
        )

    suppliers.sort(key=lambda x: x["risk_score"], reverse=True)

    high_risk_suppliers = len([s for s in suppliers if s["risk_band"] == "high"])
    medium_risk_suppliers = len([s for s in suppliers if s["risk_band"] == "medium"])
    low_risk_suppliers = len([s for s in suppliers if s["risk_band"] == "low"])

    avg_risk_score = (
        round(sum(s["risk_score"] for s in suppliers) / len(suppliers), 2)
        if suppliers
        else 0
    )

    return {
        "total_suppliers": total_suppliers,
        "high_risk_suppliers": high_risk_suppliers,
        "medium_risk_suppliers": medium_risk_suppliers,
        "low_risk_suppliers": low_risk_suppliers,
        "avg_risk_score": avg_risk_score,
        "suppliers": suppliers[:20],
    }