from datetime import date, datetime, time

from bson import ObjectId
from pymongo import ASCENDING

from app.db.database import database


class EmployeeAttendanceRepository:
    collection = database["employee_attendance"]

    @staticmethod
    def date_to_datetime(value: date) -> datetime:
        return datetime.combine(value, time.min)

    async def ensure_indexes(self):
        await self.collection.create_index(
            [
                ("employee_id", ASCENDING),
                ("date", ASCENDING),
            ],
            unique=True,
            name="unique_employee_attendance_per_day",
        )

    async def create(self, attendance_data: dict):
        if isinstance(attendance_data.get("date"), date):
            attendance_data["date"] = self.date_to_datetime(
                attendance_data["date"]
            )

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
        attendance_date: date,
    ):
        attendance_datetime = self.date_to_datetime(
            attendance_date
        )

        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "date": attendance_datetime,
            }
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
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def get_by_date(
        self,
        attendance_date: date,
        skip: int = 0,
        limit: int = 100,
    ):
        start_datetime = self.date_to_datetime(
            attendance_date
        )

        end_datetime = datetime.combine(
            attendance_date,
            time.max,
        )

        cursor = (
            self.collection
            .find(
                {
                    "date": {
                        "$gte": start_datetime,
                        "$lte": end_datetime,
                    }
                }
            )
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def get_by_date_range(
        self,
        start_date: date,
        end_date: date,
        skip: int = 0,
        limit: int = 100,
    ):
        start_datetime = self.date_to_datetime(
            start_date
        )

        end_datetime = datetime.combine(
            end_date,
            time.max,
        )

        cursor = (
            self.collection
            .find(
                {
                    "date": {
                        "$gte": start_datetime,
                        "$lte": end_datetime,
                    }
                }
            )
            .sort("date", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def update(
        self,
        attendance_id: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(attendance_id):
            return None

        if isinstance(update_data.get("date"), date):
            update_data["date"] = self.date_to_datetime(
                update_data["date"]
            )

        await self.collection.update_one(
            {"_id": ObjectId(attendance_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(attendance_id)

    async def delete(self, attendance_id: str):
        if not ObjectId.is_valid(attendance_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(attendance_id)}
        )

        return result.deleted_count > 0