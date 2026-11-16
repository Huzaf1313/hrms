from datetime import date, datetime, time

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

from app.db.database import database


class EmployeeAttendanceRegularizationRepository:
    collection = database["employee_attendance_regularization"]

    @staticmethod
    def _id_filter(regularization_id: str) -> dict:
        """Match both native Mongo IDs and legacy string IDs."""
        if ObjectId.is_valid(regularization_id):
            return {
                "$or": [
                    {"_id": ObjectId(regularization_id)},
                    {"_id": regularization_id},
                ]
            }

        return {"_id": regularization_id}

    @staticmethod
    def date_to_datetime(value: date) -> datetime:
        return datetime.combine(value, time.min)

    async def ensure_indexes(self):
        await self.collection.create_index(
            [
                ("employee_id", ASCENDING),
                ("date", ASCENDING),
            ],
            name="employee_regularization_date_index",
        )

        await self.collection.create_index(
            [
                ("status", ASCENDING),
                ("requested_at", DESCENDING),
            ],
            name="regularization_status_requested_at_index",
        )

    async def create(self, regularization_data: dict):
        if isinstance(regularization_data.get("date"), date):
            regularization_data["date"] = self.date_to_datetime(
                regularization_data["date"]
            )

        result = await self.collection.insert_one(
            regularization_data
        )

        return await self.get_by_id(
            str(result.inserted_id)
        )

    async def get_by_id(self, regularization_id: str):
        return await self.collection.find_one(
            self._id_filter(regularization_id)
        )

    async def get_by_employee(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 100,
    ):
        cursor = (
            self.collection
            .find({"employee_id": employee_id})
            .sort("requested_at", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def get_by_employee_and_attendance(
        self,
        employee_id: str,
        attendance_id: str,
    ):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "attendance_id": attendance_id,
            }
        )

    async def get_pending_by_employee_and_attendance(
        self,
        employee_id: str,
        attendance_id: str,
    ):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "attendance_id": attendance_id,
                "status": "Pending",
            }
        )

    async def get_pending_by_employee_and_date(
        self,
        employee_id: str,
        attendance_date: date,
    ):
        if isinstance(attendance_date, datetime):
            attendance_date = attendance_date.date()

        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "date": self.date_to_datetime(attendance_date),
                "status": "Pending",
            }
        )

    async def get_pending(
        self,
        skip: int = 0,
        limit: int = 100,
    ):
        cursor = (
            self.collection
            .find({"status": "Pending"})
            .sort("requested_at", 1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def get_all(
        self,
        status: str | None = None,
        skip: int = 0,
        limit: int = 100,
        employee_ids: list[str] | None = None,
    ):
        filters = {"status": status} if status else {}

        # employee_ids are business codes (EMP001), as stored on each request.
        # None means unrestricted; an empty list matches nothing.
        if employee_ids is not None:
            filters["employee_id"] = {"$in": employee_ids}
        cursor = (
            self.collection
            .find(filters)
            .sort("requested_at", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def update(
        self,
        regularization_id: str,
        update_data: dict,
    ):
        if isinstance(update_data.get("date"), date):
            update_data["date"] = self.date_to_datetime(
                update_data["date"]
            )

        await self.collection.update_one(
            self._id_filter(regularization_id),
            {"$set": update_data},
        )

        return await self.get_by_id(regularization_id)
