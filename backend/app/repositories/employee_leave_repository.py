from datetime import date, datetime, time

from bson import ObjectId
from pymongo import ASCENDING, DESCENDING

from app.db.database import database


class EmployeeLeaveRepository:

    collection = database["employee_leave"]

    @staticmethod
    def date_to_datetime(value: date) -> datetime:
        return datetime.combine(
            value,
            time.min,
        )

    async def ensure_indexes(self):
        await self.collection.create_index(
            [
                ("employee_id", ASCENDING),
                ("start_date", ASCENDING),
                ("end_date", ASCENDING),
            ],
            name="employee_leave_date_index",
        )

        await self.collection.create_index(
            [
                ("employee_id", ASCENDING),
                ("status", ASCENDING),
                ("requested_at", DESCENDING),
            ],
            name="employee_leave_status_requested_at_index",
        )

        await self.collection.create_index(
            [
                ("status", ASCENDING),
                ("requested_at", DESCENDING),
            ],
            name="employee_leave_global_status_requested_at_index",
        )

    async def create(
        self,
        leave_data: dict,
    ):
        if isinstance(leave_data.get("start_date"), date):
            leave_data["start_date"] = self.date_to_datetime(
                leave_data["start_date"]
            )

        if isinstance(leave_data.get("end_date"), date):
            leave_data["end_date"] = self.date_to_datetime(
                leave_data["end_date"]
            )

        result = await self.collection.insert_one(
            leave_data
        )

        return await self.get_by_id(
            str(result.inserted_id)
        )

    async def get_by_id(
            self,
            leave_id: str,
        ):
            if not ObjectId.is_valid(leave_id):
                return None

            return await self.collection.find_one(
                {
                    "_id": ObjectId(leave_id)
                }
            )

    async def get_by_employee(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 100,
        status: str | None = None,
    ):
        filters = {
            "employee_id": employee_id,
        }

        if status:
            filters["status"] = status

        cursor = (
            self.collection
            .find(filters)
            .sort("requested_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(
            length=limit
        )

    async def count_by_employee(
        self,
        employee_id: str,
        status: str | None = None,
    ):
        filters = {
            "employee_id": employee_id,
        }

        if status:
            filters["status"] = status

        return await self.collection.count_documents(
            filters
        )

    async def find_overlap(
        self,
        employee_id: str,
        start_date: datetime,
        end_date: datetime,
    ):
        return await self.collection.find_one(
            {
                "employee_id": employee_id,
                "status": {
                    "$in": [
                        "Pending",
                        "Approved",
                    ]
                },
                "start_date": {
                    "$lte": end_date
                },
                "end_date": {
                    "$gte": start_date
                },
            }
        )

    async def get_pending_by_employee(
        self,
        employee_id: str,
    ):
        return await self.collection.find(
            {
                "employee_id": employee_id,
                "status": "Pending",
            }
        ).sort(
            "requested_at",
            DESCENDING,
        ).to_list(
            length=100
        )

    async def get_upcoming_by_employee(
        self,
        employee_id: str,
        from_date: datetime,
    ):
        cursor = (
            self.collection
            .find(
                {
                    "employee_id": employee_id,
                    "status": {
                        "$in": [
                            "Approved",
                            "approved",
                        ],
                    },
                    "end_date": {
                        "$gte": from_date
                    },
                }
            )
            .sort(
                "start_date",
                ASCENDING,
            )
        )

        return await cursor.to_list(
            length=100
        )

    async def get_balance_records(
        self,
        employee_id: str,
    ):
        cursor = (
            self.collection
            .find(
                {
                    "employee_id": employee_id,
                    "status": {
                        "$in": [
                            "Approved",
                            "approved",
                        ],
                    },
                }
            )
            .sort(
                "start_date",
                ASCENDING,
            )
        )

        return await cursor.to_list(
            length=1000
        )

    async def update(
        self,
        leave_id: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(leave_id):
            return None

        if isinstance(update_data.get("start_date"), date):
            update_data["start_date"] = self.date_to_datetime(
                update_data["start_date"]
            )

        if isinstance(update_data.get("end_date"), date):
            update_data["end_date"] = self.date_to_datetime(
                update_data["end_date"]
            )

        await self.collection.update_one(
            {
                "_id": ObjectId(leave_id)
            },
            {
                "$set": update_data
            },
        )

        return await self.get_by_id(
            leave_id
        )