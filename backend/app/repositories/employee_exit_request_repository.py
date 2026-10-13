import re
from datetime import date, datetime, time
from typing import List
from bson import ObjectId
from pymongo import ASCENDING, DESCENDING
 
from app.db.database import database
 
 
class ExitRequestRepository:
    collection = database["exit_requests"]
    users = database["users"]
 
    @staticmethod
    def _to_datetime(value: date) -> datetime:
        return datetime.combine(value, time.min)
 
    async def ensure_indexes(self):
        await self.collection.create_index(
            [
                ("employee_id", ASCENDING),
                ("status", ASCENDING),
                ("submitted_at", DESCENDING),
            ],
            name="exit_request_employee_status_submitted_index",
        )
        await self.collection.create_index(
            [("status", ASCENDING), ("submitted_at", DESCENDING)],
            name="exit_request_status_submitted_index",
        )
 
    async def create(self, data: dict):
        if isinstance(data.get("last_working_day"), date) and not isinstance(
            data["last_working_day"], datetime
        ):
            data["last_working_day"] = self._to_datetime(data["last_working_day"])
 
        result = await self.collection.insert_one(data)
        return await self.get_by_id(str(result.inserted_id))
 
    async def get_by_id(self, request_id: str):
        if not ObjectId.is_valid(request_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(request_id)})
 
    async def find_active_for_employee(self, employee_id: str, statuses: list[str]):
        return await self.collection.find_one(
            {"employee_id": employee_id, "status": {"$in": statuses}}
        )
 
    @staticmethod
    def _filters(
        employee_id: str | None = None,
        status: str | None = None,
        search: str | None = None,
        exit_type: str | None = None,
        department_id: str | None = None,
        submitted_from: datetime | None = None,
        submitted_to: datetime | None = None,
    ) -> dict:
        filters: dict = {}
        if employee_id:
            filters["employee_id"] = employee_id
        if status:
            filters["status"] = status
        if exit_type:
            filters["exit_type"] = exit_type
        if department_id:
            filters["department_id"] = department_id

        # Inclusive on both ends of the requested window.
        if submitted_from or submitted_to:
            window: dict = {}
            if submitted_from:
                window["$gte"] = submitted_from
            if submitted_to:
                window["$lte"] = submitted_to
            filters["submitted_at"] = window

        if search:
            pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
            filters["$or"] = [{"employee_name": pattern}, {"employee_id": pattern}]
        return filters

    async def list_requests(
        self,
        skip: int,
        limit: int,
        employee_id: str | None = None,
        status: str | None = None,
        search: str | None = None,
        exit_type: str | None = None,
        department_id: str | None = None,
        submitted_from: datetime | None = None,
        submitted_to: datetime | None = None,
    ):
        filters = self._filters(
            employee_id,
            status,
            search,
            exit_type,
            department_id,
            submitted_from,
            submitted_to,
        )
        cursor = (
            self.collection.find(filters)
            .sort("submitted_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def count(
        self,
        employee_id: str | None = None,
        status: str | None = None,
        search: str | None = None,
        exit_type: str | None = None,
        department_id: str | None = None,
        submitted_from: datetime | None = None,
        submitted_to: datetime | None = None,
    ):
        return await self.collection.count_documents(
            self._filters(
                employee_id,
                status,
                search,
                exit_type,
                department_id,
                submitted_from,
                submitted_to,
            )
        )

    async def count_by_status(self, filters: dict | None = None):
        rows = await self.collection.aggregate(
            [
                {"$match": filters or {}},
                {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            ]
        ).to_list(length=20)
        return {row["_id"]: row["count"] for row in rows}

    async def count_by_type(self) -> dict[str, int]:
        """Request count per exit type.

        Documents written before exit_type existed are counted as Resignation,
        which is what they were: the employee form is the only writer and it
        always recorded a resignation.
        """

        rows = await self.collection.aggregate(
            [
                {
                    "$group": {
                        "_id": {"$ifNull": ["$exit_type", "Resignation"]},
                        "count": {"$sum": 1},
                    }
                }
            ]
        ).to_list(length=None)

        return {row["_id"]: row["count"] for row in rows}

    async def count_by_department(self) -> list[dict]:
        return await self.collection.aggregate(
            [
                {
                    "$group": {
                        "_id": "$department_id",
                        "count": {"$sum": 1},
                    }
                },
                {"$sort": {"count": -1}},
            ]
        ).to_list(length=None)
 
    async def update_if_status(
        self, request_id: str, expected_status: str, update_data: dict
    ) -> bool:
        """Atomic transition: only applies if the status is still what we read."""
        if not ObjectId.is_valid(request_id):
            return False
        result = await self.collection.update_one(
            {"_id": ObjectId(request_id), "status": expected_status},
            {"$set": update_data},
        )
        return result.modified_count == 1
 
    async def get_hr_emails(self) -> list[str]:
        rows = await self.users.find(
            {"role": "hr_admin", "is_active": True}, {"email": 1}
        ).to_list(length=100)
        return [row["email"] for row in rows if row.get("email")]