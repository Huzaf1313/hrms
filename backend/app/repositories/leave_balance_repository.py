from datetime import datetime, timezone

from app.db.database import database


class LeaveBalanceRepository:
    collection = database["leave_balances"]

    async def get_all(self):
        cursor = self.collection.find({})

        return await cursor.to_list(length=100)

    async def get_active(self):
        cursor = self.collection.find({"active": {"$ne": False}}).sort("leave_type", 1)

        return await cursor.to_list(length=100)

    async def find_by_type(self, leave_type: str):
        return await self.collection.find_one(
            {"leave_type": leave_type}
        )

    async def upsert(self, leave_type: str, update_data: dict):
        await self.collection.update_one(
            {"leave_type": leave_type},
            {
                "$set": {
                    **update_data,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$setOnInsert": {"leave_type": leave_type},
            },
            upsert=True,
        )

        return await self.find_by_type(leave_type)

    async def deactivate(self, leave_type: str):
        result = await self.collection.update_one(
            {"leave_type": leave_type},
            {
                "$set": {
                    "active": False,
                    "updated_at": datetime.now(timezone.utc),
                },
                "$setOnInsert": {
                    "leave_type": leave_type,
                    "used": 0,
                    "total": 0,
                },
            },
            upsert=True,
        )

        return result.modified_count > 0 or result.upserted_id is not None
