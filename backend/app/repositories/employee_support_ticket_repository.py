from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

from app.db.database import database


class EmployeeSupportTicketRepository:
    """Database operations for employee support tickets."""

    def __init__(self):
        self.collection_name = "employee_support_tickets"

    def get_collection(self):
        return database[self.collection_name]

    async def create(
        self,
        ticket_data: dict[str, Any],
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)

        document = {
            **ticket_data,
            "created_at": now,
            "updated_at": now,
        }

        result = await self.get_collection().insert_one(document)

        document["_id"] = result.inserted_id

        return document

    async def get_by_id(
        self,
        ticket_id: str,
        employee_id: str,
    ) -> dict[str, Any] | None:
        if not ObjectId.is_valid(ticket_id):
            return None

        return await self.get_collection().find_one(
            {
                "_id": ObjectId(ticket_id),
                "employee_id": employee_id,
            }
        )

    async def get_by_employee(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 10,
    ) -> tuple[list[dict[str, Any]], int]:
        collection = self.get_collection()

        query = {"employee_id": employee_id}

        total = await collection.count_documents(query)

        cursor = (
            collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

        tickets = await cursor.to_list(length=limit)

        return tickets, total

    async def get_by_id_any_owner(self, ticket_id: str):
        """Admin-side lookup: a ticket is visible regardless of who raised it."""
        if not ObjectId.is_valid(ticket_id):
            return None

        return await self.get_collection().find_one(
            {"_id": ObjectId(ticket_id)}
        )

    async def list_all(
        self,
        status: str | None = None,
        category: str | None = None,
        priority: str | None = None,
        search: str | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[dict[str, Any]], int]:
        collection = self.get_collection()

        query: dict[str, Any] = {}

        if status:
            query["status"] = status

        if category:
            query["category"] = category

        if priority:
            query["priority"] = priority

        if search:
            # Regex rather than $text so a partial word still matches, which is
            # what a search box should do here.
            pattern = {"$regex": search.strip(), "$options": "i"}

            query["$or"] = [
                {"subject": pattern},
                {"description": pattern},
                {"employee_id": pattern},
            ]

        total = await collection.count_documents(query)

        cursor = (
            collection.find(query)
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )

        tickets = await cursor.to_list(length=limit)

        return tickets, total

    async def update_ticket(
        self,
        ticket_id: str,
        update_data: dict[str, Any],
    ) -> dict[str, Any] | None:
        if not ObjectId.is_valid(ticket_id):
            return None

        update_data = {**update_data, "updated_at": datetime.now(timezone.utc)}

        await self.get_collection().update_one(
            {"_id": ObjectId(ticket_id)},
            {"$set": update_data},
        )

        return await self.get_by_id_any_owner(ticket_id)

    async def count_by_status(self) -> dict[str, int]:
        rows = await (
            self.get_collection()
            .aggregate([
                {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            ])
            .to_list(length=None)
        )

        return {row["_id"]: row["count"] for row in rows if row.get("_id")}

    async def get_analytics(
        self,
        open_statuses: list[str],
        high_priorities: list[str],
        stale_after_days: int = 3,
    ) -> dict[str, Any]:
        """Everything the admin dashboard needs, in a single round trip.

        Counting in Mongo rather than pulling tickets into Python keeps this
        cheap as the table grows, and means the KPI row and the list below it
        always agree because they read the same source.
        """
        now = datetime.now(timezone.utc)

        day_ms = 24 * 60 * 60 * 1000

        def age_expression(field: str = "$created_at") -> dict[str, Any]:
            return {
                "$divide": [
                    {"$subtract": [now, field]},
                    day_ms,
                ]
            }

        pipeline = [
            {
                "$facet": {
                    "status": [
                        {
                            "$group": {
                                "_id": "$status",
                                "count": {"$sum": 1},
                            }
                        }
                    ],
                    "category": [
                        {
                            "$group": {
                                "_id": "$category",
                                "count": {"$sum": 1},
                                "still_open": {
                                    "$sum": {
                                        "$cond": [
                                            {"$in": ["$status", open_statuses]},
                                            1,
                                            0,
                                        ]
                                    }
                                },
                            }
                        }
                    ],
                    "priority": [
                        {
                            "$group": {
                                "_id": "$priority",
                                "count": {"$sum": 1},
                                "still_open": {
                                    "$sum": {
                                        "$cond": [
                                            {"$in": ["$status", open_statuses]},
                                            1,
                                            0,
                                        ]
                                    }
                                },
                            }
                        }
                    ],
                    "resolution": [
                        {
                            "$match": {
                                "handled_at": {"$type": "date"},
                            }
                        },
                        {
                            "$project": {
                                "hours": {
                                    "$divide": [
                                        {
                                            "$subtract": [
                                                "$handled_at",
                                                "$created_at",
                                            ]
                                        },
                                        60 * 60 * 1000,
                                    ]
                                }
                            }
                        },
                        {
                            "$group": {
                                "_id": None,
                                "avg_hours": {"$avg": "$hours"},
                                "count": {"$sum": 1},
                            }
                        },
                    ],
                    "aging": [
                        {"$match": {"status": {"$in": open_statuses}}},
                        {
                            "$project": {
                                "age_days": age_expression(),
                                # Carried through explicitly: a $project drops
                                # every field it does not name, so without this
                                # the $group below cannot see priority.
                                "priority": 1,
                            }
                        },
                        {
                            "$group": {
                                "_id": None,
                                "count": {"$sum": 1},
                                "avg_age_days": {"$avg": "$age_days"},
                                "oldest_age_days": {"$max": "$age_days"},
                                "stale_count": {
                                    "$sum": {
                                        "$cond": [
                                            {
                                                "$gt": [
                                                    "$age_days",
                                                    stale_after_days,
                                                ]
                                            },
                                            1,
                                            0,
                                        ]
                                    }
                                },
                                "urgent_open": {
                                    "$sum": {
                                        "$cond": [
                                            {
                                                "$in": [
                                                    "$priority",
                                                    high_priorities,
                                                ]
                                            },
                                            1,
                                            0,
                                        ]
                                    }
                                },
                            }
                        },
                    ],
                }
            }
        ]

        rows = await self.get_collection().aggregate(pipeline).to_list(
            length=1
        )

        facets = rows[0] if rows else {}

        def collapse(field: str) -> dict[str, int]:
            return {
                item["_id"]: item["count"]
                for item in facets.get(field, [])
                if item.get("_id")
            }

        def collapse_open(field: str) -> dict[str, int]:
            return {
                item["_id"]: item["still_open"]
                for item in facets.get(field, [])
                if item.get("_id")
            }

        counts_by_status = collapse("status")

        total = sum(counts_by_status.values())

        open_total = sum(
            counts_by_status.get(status, 0) for status in open_statuses
        )

        resolution = (facets.get("resolution") or [{}])[0]
        aging = (facets.get("aging") or [{}])[0]

        resolved_count = total - open_total

        avg_hours = resolution.get("avg_hours")

        return {
            "total": total,
            "counts_by_status": counts_by_status,
            "counts_by_category": collapse("category"),
            "counts_by_priority": collapse("priority"),
            "open_by_category": collapse_open("category"),
            "open_by_priority": collapse_open("priority"),
            "unhandled_count": open_total,
            "resolved_count": resolved_count,
            "resolution_rate": (
                round(resolved_count / total, 4) if total else 0.0
            ),
            "avg_resolution_hours": (
                round(avg_hours, 2)
                if isinstance(avg_hours, (int, float))
                else None
            ),
            "resolved_sample_size": resolution.get("count", 0),
            "avg_open_age_days": self._round_or_none(
                aging.get("avg_age_days")
            ),
            "oldest_open_age_days": self._round_or_none(
                aging.get("oldest_age_days")
            ),
            "stale_open_count": aging.get("stale_count", 0),
            "stale_after_days": stale_after_days,
            "urgent_open_count": aging.get("urgent_open", 0),
        }

    @staticmethod
    def _round_or_none(value: Any) -> float | None:
        if not isinstance(value, (int, float)):
            return None

        return round(float(value), 2)

    async def ensure_indexes(self):
        await self.get_collection().create_index(
            [("created_at", DESCENDING)],
            name="support_ticket_created_index",
        )

        await self.get_collection().create_index(
            [("status", ASCENDING), ("created_at", DESCENDING)],
            name="support_ticket_status_created_index",
        )