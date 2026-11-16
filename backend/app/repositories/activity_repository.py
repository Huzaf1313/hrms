from datetime import datetime

from pymongo import DESCENDING

from app.db.database import database

# The `target` every announcement activity is recorded with.
ANNOUNCEMENT_TARGET = "/dashboard/announcements"


class ActivityRepository:
    collection = database["activity_events"]

    async def ensure_indexes(self):
        await self.collection.create_index(
            [("created_at", DESCENDING)],
            name="activity_created_at",
        )
        await self.collection.create_index(
            [("employee_id", 1), ("created_at", DESCENDING)],
            name="activity_employee_created_at",
        )

    async def create(self, event: dict) -> dict:
        result = await self.collection.insert_one(event)
        return await self.collection.find_one({"_id": result.inserted_id})

    async def list_recent(
        self,
        limit: int = 5,
        employee_ids: list[str] | None = None,
        actor_id: str | None = None,
    ) -> list[dict]:
        query: dict = {}

        if employee_ids is not None:
            visibility = [{"employee_id": {"$in": employee_ids}}]

            if actor_id:
                visibility.append({"actor_id": actor_id})

            # Announcements are company news, not tied to any one employee,
            # so a scoped viewer (a manager) gets them whoever posted them.
            visibility.append({"target": ANNOUNCEMENT_TARGET})

            query["$or"] = visibility

        cursor = (
            self.collection.find(query)
            .sort("created_at", DESCENDING)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)
