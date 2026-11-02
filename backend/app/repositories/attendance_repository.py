from datetime import date, datetime

from bson import ObjectId

from app.db.database import database


def _as_date(value) -> date:
    """Mongo stores a datetime; the trend is keyed by calendar day."""
    if isinstance(value, datetime):
        return value.date()

    return value


class AttendanceRepository:
    collection = database["employee_attendance"]

    async def create(self, attendance_data: dict):
        result = await self.collection.insert_one(attendance_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, attendance_id: str):
        if not ObjectId.is_valid(attendance_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(attendance_id)}
        )

    async def get_by_employee_and_date(
        self,
        employee_id: str,
        attendance_date,
    ):
        """attendance_date must already be normalized to midnight datetime."""
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "date": attendance_date,
            }
        )

    async def get_all(
        self,
        filters: dict,
        skip: int,
        limit: int,
    ):
        cursor = (
            self.collection
            .find(filters)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count(self, filters: dict):
        return await self.collection.count_documents(filters)

    async def get_distinct_employee_ids(self, filters: dict):
        return await self.collection.distinct("employee_id", filters)

    async def update(
        self,
        attendance_id: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(attendance_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(attendance_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(attendance_id)

    async def get_status_counts(self, filters: dict):
        """Returns e.g. {"present": 218, "late": 18, ...} for the given filters."""
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": {"$toLower": "$status"},
                    "count": {"$sum": 1},
                }
            },
        ]

        results = await self.collection.aggregate(pipeline).to_list(length=None)

        return {item["_id"]: item["count"] for item in results}

    async def get_department_status_counts(self, filters: dict):
        """Returns e.g. [{"_id": {"department_id": "...", "status": "present"}, "count": 12}, ...]."""
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": {
                        "department_id": "$department_id",
                        "status": {"$toLower": "$status"},
                    },
                    "count": {"$sum": 1},
                }
            },
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)

    async def get_daily_status_counts(self, filters: dict):
        """Counts per day and status.

        Returns [{"date": datetime, "status": "present", "count": 12}, ...].
        """
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": {
                        "date": "$date",
                        "status": {"$toLower": "$status"},
                    },
                    "count": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "date": "$_id.date",
                    "status": "$_id.status",
                    "count": 1,
                }
            },
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)

    async def get_daily_marked_counts(self, filters: dict):
        """How many employees have a record on each day.

        Returns {date: count}. An employee with no record for a day counts as
        absent, so the caller needs this to match the single-day summary.
        """
        pipeline = [
            {"$match": filters},
            {
                "$group": {
                    "_id": {
                        "date": "$date",
                        "employee_id": "$employee_id",
                    },
                }
            },
            {
                "$group": {
                    "_id": "$_id.date",
                    "count": {"$sum": 1},
                }
            },
        ]

        results = await self.collection.aggregate(pipeline).to_list(length=None)

        return {
            _as_date(item["_id"]): item["count"]
            for item in results
        }