from app.core.database import db


async def get_suppliers_overview():
    total_suppliers = len(await db.shipments_raw.distinct("supplier_id"))

    pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "supplier_name": {"$first": "$supplier_name"},
                "supplier_country": {"$first": "$supplier_country"},
                "supplier_region": {"$first": "$supplier_region"},
                "avg_delay_hours": {"$avg": "$delay_hours"},
                "avg_inventory_level": {"$avg": "$inventory_level"},
                "avg_lead_time": {"$avg": "$supplier_lead_time"},
                "shipment_count": {"$sum": 1}
            }
        },
        {
            "$addFields": {
                "risk_score": {
                    "$round": [
                        {
                            "$min": [
                                100,
                                {
                                    "$add": [
                                        {"$multiply": ["$avg_delay_hours", 2.0]},
                                        {"$multiply": ["$avg_lead_time", 1.2]},
                                        {
                                            "$multiply": [
                                                {
                                                    "$max": [
                                                        0,
                                                        {
                                                            "$subtract": [
                                                                1,
                                                                {"$divide": ["$avg_inventory_level", 1000]}
                                                            ]
                                                        }
                                                    ]
                                                },
                                                25
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        2
                    ]
                },
                "dependency_score": {
                    "$round": [
                        {
                            "$min": [
                                100,
                                {
                                    "$add": [
                                        {
                                            "$multiply": [
                                                {"$divide": ["$shipment_count", 300]},
                                                60
                                            ]
                                        },
                                        {
                                            "$multiply": [
                                                {"$divide": ["$avg_lead_time", 30]},
                                                40
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },
                        2
                    ]
                }
            }
        },
        {"$sort": {"risk_score": -1}}
    ]

    suppliers = await db.shipments_raw.aggregate(pipeline).to_list(None)

    high_risk_suppliers = len(
        [supplier for supplier in suppliers if supplier["risk_score"] > 70]
    )

    medium_risk_suppliers = len(
        [
            supplier
            for supplier in suppliers
            if 40 < supplier["risk_score"] <= 70
        ]
    )

    low_risk_suppliers = len(
        [supplier for supplier in suppliers if supplier["risk_score"] <= 40]
    )

    avg_risk_score = (
        round(sum(supplier["risk_score"] for supplier in suppliers) / len(suppliers), 2)
        if suppliers
        else 0
    )

    for supplier in suppliers:
        score = supplier["risk_score"]
        if score > 70:
            supplier["risk_band"] = "high"
        elif score > 40:
            supplier["risk_band"] = "medium"
        else:
            supplier["risk_band"] = "low"

        supplier["supplier_id"] = supplier.pop("_id")

    return {
        "total_suppliers": total_suppliers,
        "high_risk_suppliers": high_risk_suppliers,
        "medium_risk_suppliers": medium_risk_suppliers,
        "low_risk_suppliers": low_risk_suppliers,
        "avg_risk_score": avg_risk_score,
        "suppliers": suppliers
    }