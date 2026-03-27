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


async def get_logistics_overview():
    pipeline = [
        {
            "$group": {
                "_id": None,
                "avg_delay_hours": {"$avg": "$delay_hours"},
                "avg_expected_time": {"$avg": "$expected_time_hours"},
                "avg_actual_time": {"$avg": "$actual_time_hours"},
                "total_shipments": {"$sum": 1},
            }
        }
    ]

    result = await db.shipments_raw.aggregate(pipeline).to_list(1)

    if not result:
        return {
            "total_shipments": 0,
            "avg_delay_hours": 0,
            "avg_expected_time_hours": 0,
            "avg_actual_time_hours": 0,
            "avg_throughput_pct": 0,
            "peak_delay_day": None,
            "delay_distribution": {"low": 0, "medium": 0, "high": 0},
        }

    data = result[0]

    avg_delay = round(data["avg_delay_hours"], 2)
    avg_expected = round(data["avg_expected_time"], 2)
    avg_actual = round(data["avg_actual_time"], 2)

    avg_throughput_pct = round(
        max(0, min(100, 100 - ((avg_delay / avg_expected) * 100))) if avg_expected > 0 else 0,
        2,
    )

    peak_day_pipeline = [
        {
            "$addFields": {
                "parsed_date": {"$dateFromString": {"dateString": "$date"}}
            }
        },
        {
            "$group": {
                "_id": {"$dayOfWeek": "$parsed_date"},
                "avg_delay": {"$avg": "$delay_hours"}
            }
        },
        {"$sort": {"avg_delay": -1}},
        {"$limit": 1}
    ]

    peak_day_result = await db.shipments_raw.aggregate(peak_day_pipeline).to_list(1)
    peak_delay_day = (
        {
            "day": DAY_NAME_MAP.get(peak_day_result[0]["_id"], "Unknown"),
            "avg_delay_hours": round(peak_day_result[0]["avg_delay"], 2),
        }
        if peak_day_result
        else None
    )

    low = await db.shipments_raw.count_documents({"delay_hours": {"$lte": 8}})
    medium = await db.shipments_raw.count_documents({"delay_hours": {"$gt": 8, "$lte": 20}})
    high = await db.shipments_raw.count_documents({"delay_hours": {"$gt": 20}})

    return {
        "total_shipments": data["total_shipments"],
        "avg_delay_hours": avg_delay,
        "avg_expected_time_hours": avg_expected,
        "avg_actual_time_hours": avg_actual,
        "avg_throughput_pct": avg_throughput_pct,
        "peak_delay_day": peak_delay_day,
        "delay_distribution": {
            "low": low,
            "medium": medium,
            "high": high,
        },
    }


async def get_logistics_timeseries():
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
                "avg_expected_time_hours": {"$avg": "$expected_time_hours"},
            }
        }
    ]

    raw = await db.shipments_raw.aggregate(pipeline).to_list(None)

    rows = []
    for item in raw:
        avg_delay = round(item["avg_delay_hours"], 2)
        avg_expected = round(item["avg_expected_time_hours"], 2)
        throughput = round(
            max(0, min(100, 100 - ((avg_delay / avg_expected) * 100))) if avg_expected > 0 else 0,
            2,
        )

        day_name = DAY_NAME_MAP.get(item["_id"], "Unknown")

        rows.append({
            "day": day_name,
            "avg_delay_hours": avg_delay,
            "throughput_pct": throughput,
        })

    rows.sort(key=lambda x: DAY_ORDER.get(x["day"], 99))
    return rows