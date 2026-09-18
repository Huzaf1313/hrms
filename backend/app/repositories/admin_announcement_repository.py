from datetime import datetime, timezone

from bson import ObjectId

from app.db.database import database


class AdminAnnouncementRepository:
    collection = database["announcements"]

    async def ensure_indexes(self):
        await self.collection.create_index([("category", 1)])
        await self.collection.create_index([("publish_date", -1)])
        await self.collection.create_index([("pinned", -1)])

    async def create(self, announcement_data: dict):
        result = await self.collection.insert_one(announcement_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, announcement_id: str):
        if not ObjectId.is_valid(announcement_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(announcement_id)}
        )

    async def get_all(self, filters: dict, skip: int, limit: int):
        cursor = (
            self.collection
            .find(filters)
            .sort([("pinned", -1), ("publish_date", -1)])
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count(self, filters: dict):
        return await self.collection.count_documents(filters)

    async def update(self, announcement_id: str, update_data: dict):
        if not ObjectId.is_valid(announcement_id):
            return None

        update_data["updated_at"] = datetime.now(timezone.utc)

        await self.collection.update_one(
            {"_id": ObjectId(announcement_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(announcement_id)

    async def delete(self, announcement_id: str):
        if not ObjectId.is_valid(announcement_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(announcement_id)}
        )

        return result.deleted_count > 0