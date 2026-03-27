from app.core.database import db


DAY_NAME_MAP = {
    1: "Sunday",
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
    7: "Saturday",
}

DAY_ORDER = {
    "Monday": 1,
    "Tuesday": 2,
    "Wednesday": 3,
    "Thursday": 4,
    "Friday": 5,
    "Saturday": 6,
    "Sunday": 7,
}


async def get_analytics_overview():
    pipeline = [
        {
            "$group": {
                "_id": None,
                "avg_delay_hours": {"$avg": "$delay_hours"},
                "avg_inventory_level": {"$avg": "$inventory_level"},
                "avg_expected_time": {"$avg": "$expected_time_hours"},
                "avg_weather_risk": {"$avg": "$weather_risk"},
                "avg_port_congestion": {"$avg": "$port_congestion"},
            }
        }
    ]

    result = await db.shipments_raw.aggregate(pipeline).to_list(1)

    if not result:
        return {
            "avg_forecast_risk": 0,
            "forecast_drift": 0,
            "avg_supplier_risk": 0,
            "critical_alerts": 0,
            "avg_delay_hours": 0,
        }

    data = result[0]

    avg_delay = float(data.get("avg_delay_hours", 0) or 0)
    avg_inventory = float(data.get("avg_inventory_level", 0) or 0)
    avg_weather = float(data.get("avg_weather_risk", 0) or 0)
    avg_congestion = float(data.get("avg_port_congestion", 0) or 0)

    # rule-based analytics score for now
    avg_forecast_risk = min(
        100,
        round(
            (avg_delay * 1.5)
            + (avg_weather * 20)
            + (avg_congestion * 20)
            + max(0, (1 - (avg_inventory / 1000))) * 20,
            2,
        ),
    )

    forecast_drift = round(avg_forecast_risk * 0.12, 2)

    supplier_risk_pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "avg_delay": {"$avg": "$delay_hours"},
                "avg_lead_time": {"$avg": "$supplier_lead_time"},
                "avg_inventory": {"$avg": "$inventory_level"},
            }
        },
        {
            "$project": {
                "risk_score": {
                    "$min": [
                        100,
                        {
                            "$add": [
                                {"$multiply": ["$avg_delay", 1.5]},
                                {"$multiply": ["$avg_lead_time", 0.9]},
                                {
                                    "$multiply": [
                                        {
                                            "$max": [
                                                0,
                                                {
                                                    "$subtract": [
                                                        1,
                                                        {"$divide": ["$avg_inventory", 1000]},
                                                    ]
                                                },
                                            ]
                                        },
                                        20,
                                    ]
                                },
                            ]
                        },
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": None,
                "avg_supplier_risk": {"$avg": "$risk_score"}
            }
        }
    ]

    supplier_risk_result = await db.shipments_raw.aggregate(supplier_risk_pipeline).to_list(1)
    avg_supplier_risk = round(
        supplier_risk_result[0]["avg_supplier_risk"], 2
    ) if supplier_risk_result else 0

    critical_alerts = await db.alerts.count_documents({"level": "critical"})

    return {
        "avg_forecast_risk": avg_forecast_risk,
        "forecast_drift": forecast_drift,
        "avg_supplier_risk": avg_supplier_risk,
        "critical_alerts": critical_alerts,
        "avg_delay_hours": round(avg_delay, 2),
    }


async def get_forecast_series():
    pipeline = [
        {
            "$addFields": {
                "parsed_date": {"$dateFromString": {"dateString": "$date"}}
            }
        },
        {
            "$group": {
                "_id": {"$dayOfWeek": "$parsed_date"},
                "avg_delay_hours": {"$avg": "$delay_hours"},
                "avg_weather_risk": {"$avg": "$weather_risk"},
                "avg_port_congestion": {"$avg": "$port_congestion"},
                "avg_inventory_level": {"$avg": "$inventory_level"},
            }
        }
    ]

    raw = await db.shipments_raw.aggregate(pipeline).to_list(None)

    rows = []
    for item in raw:
        current = min(
            100,
            round(
                (float(item.get("avg_delay_hours", 0) or 0) * 1.5)
                + (float(item.get("avg_weather_risk", 0) or 0) * 20)
                + (float(item.get("avg_port_congestion", 0) or 0) * 20),
                2,
            ),
        )

        forecast = min(100, round(current * 1.08, 2))
        drift = round(forecast - current, 2)

        day_name = DAY_NAME_MAP.get(item["_id"], "Unknown")

        rows.append({
            "day": day_name,
            "current": current,
            "forecast": forecast,
            "drift": drift,
        })

    rows.sort(key=lambda x: DAY_ORDER.get(x["day"], 99))
    return rows


async def get_supplier_exposure():
    pipeline = [
        {
            "$group": {
                "_id": "$supplier_id",
                "supplier_name": {"$first": "$supplier_name"},
                "avg_delay_hours": {"$avg": "$delay_hours"},
                "avg_lead_time": {"$avg": "$supplier_lead_time"},
                "avg_inventory_level": {"$avg": "$inventory_level"},
                "shipment_count": {"$sum": 1},
            }
        },
        {
            "$addFields": {
                "risk_score": {
                    "$min": [
                        100,
                        {
                            "$add": [
                                {"$multiply": ["$avg_delay_hours", 1.5]},
                                {"$multiply": ["$avg_lead_time", 0.9]},
                                {
                                    "$multiply": [
                                        {
                                            "$max": [
                                                0,
                                                {
                                                    "$subtract": [
                                                        1,
                                                        {"$divide": ["$avg_inventory_level", 1000]},
                                                    ]
                                                },
                                            ]
                                        },
                                        20,
                                    ]
                                },
                            ]
                        },
                    ]
                },
                "dependency_score": {
                    "$min": [
                        100,
                        {
                            "$add": [
                                {"$multiply": [{"$divide": ["$shipment_count", 300]}, 60]},
                                {"$multiply": [{"$divide": ["$avg_lead_time", 30]}, 40]},
                            ]
                        },
                    ]
                },
            }
        },
        {
            "$project": {
                "_id": 0,
                "supplier_id": "$_id",
                "supplier_name": 1,
                "risk_score": {"$round": ["$risk_score", 2]},
                "dependency_score": {"$round": ["$dependency_score", 2]},
                "combined_score": {
                    "$round": [
                        {"$divide": [{"$add": ["$risk_score", "$dependency_score"]}, 2]},
                        2,
                    ]
                },
            }
        },
        {"$sort": {"combined_score": -1}},
        {"$limit": 10},
    ]

    return await db.shipments_raw.aggregate(pipeline).to_list(None)


async def get_lane_pressure():
    pipeline = [
        {
            "$addFields": {
                "lane": {
                    "$concat": [
                        "$tier1_origin_port",
                        " → ",
                        "$tier3_destination_port"
                    ]
                }
            }
        },
        {
            "$group": {
                "_id": "$lane",
                "avg_delay_hours": {"$avg": "$delay_hours"},
                "avg_expected_time": {"$avg": "$expected_time_hours"},
                "avg_weather_risk": {"$avg": "$weather_risk"},
                "avg_port_congestion": {"$avg": "$port_congestion"},
                "shipment_count": {"$sum": 1},
            }
        },
        {
            "$project": {
                "_id": 0,
                "lane": "$_id",
                "avg_delay_hours": {"$round": ["$avg_delay_hours", 2]},
                "throughput_pct": {
                    "$round": [
                        {
                            "$max": [
                                0,
                                {
                                    "$min": [
                                        100,
                                        {
                                            "$subtract": [
                                                100,
                                                {
                                                    "$multiply": [
                                                        {"$divide": ["$avg_delay_hours", "$avg_expected_time"]},
                                                        100,
                                                    ]
                                                },
                                            ]
                                        },
                                    ]
                                },
                            ]
                        },
                        2,
                    ]
                },
                "pressure_score": {
                    "$round": [
                        {
                            "$min": [
                                100,
                                {
                                    "$add": [
                                        {"$multiply": ["$avg_delay_hours", 1.2]},
                                        {"$multiply": ["$avg_weather_risk", 20]},
                                        {"$multiply": ["$avg_port_congestion", 20]},
                                    ]
                                },
                            ]
                        },
                        2,
                    ]
                },
                "shipment_count": 1,
            }
        },
        {"$sort": {"pressure_score": -1}},
        {"$limit": 10},
    ]

    return await db.shipments_raw.aggregate(pipeline).to_list(None)