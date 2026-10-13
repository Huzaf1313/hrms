from datetime import datetime, timezone

from bson import ObjectId
from pymongo import DESCENDING

from app.db.database import database


class EmployeeNotificationRepository:
    collection = database["notifications"]

    async def create(self, notification_data: dict):
        now = datetime.now(timezone.utc)

        notification_data.setdefault("created_at", now)
        notification_data.setdefault("is_read", False)
        notification_data.setdefault("read_at", None)

        result = await self.collection.insert_one(notification_data)

        return await self.get_by_id(str(result.inserted_id))

    async def create_many(self, notifications: list[dict]):
        if not notifications:
            return []

        now = datetime.now(timezone.utc)

        documents = []

        for notification in notifications:
            notification.setdefault("created_at", now)
            notification.setdefault("is_read", False)
            notification.setdefault("read_at", None)
            documents.append(notification)

        result = await self.collection.insert_many(documents)

        return await self.collection.find(
            {"_id": {"$in": result.inserted_ids}}
        ).to_list(length=len(result.inserted_ids))

    async def get_by_id(self, notification_id: str):
        if not ObjectId.is_valid(notification_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(notification_id)}
        )

    async def get_by_employee(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 20,
    ):
        cursor = (
            self.collection
            .find({"employee_id": employee_id})
            .sort("created_at", DESCENDING)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count_unread(self, employee_id: str):
        return await self.collection.count_documents(
            {
                "employee_id": employee_id,
                "is_read": False,
            }
        )

    async def mark_as_read(
        self,
        notification_id: str,
        employee_id: str,
    ):
        if not ObjectId.is_valid(notification_id):
            return None

        await self.collection.update_one(
            {
                "_id": ObjectId(notification_id),
                "employee_id": employee_id,
            },
            {
                "$set": {
                    "is_read": True,
                    "read_at": datetime.now(timezone.utc),
                }
            },
        )

        return await self.get_by_id(notification_id)

    async def mark_all_as_read(self, employee_id: str):
        now = datetime.now(timezone.utc)

        result = await self.collection.update_many(
            {
                "employee_id": employee_id,
                "is_read": False,
            },
            {
                "$set": {
                    "is_read": True,
                    "read_at": now,
                }
            },
        )

        return result.modified_count

    async def ensure_indexes(self):
        await self.collection.create_index(
            [
                ("employee_id", 1),
                ("created_at", -1),
            ],
            name="notification_employee_created_index",
        )

        await self.collection.create_index(
            [
                ("employee_id", 1),
                ("is_read", 1),
            ],
            name="notification_employee_read_index",
        )