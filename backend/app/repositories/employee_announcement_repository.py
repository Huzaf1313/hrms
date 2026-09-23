from typing import Any

from app.db.database import database


class EmployeeAnnouncementRepository:
    def __init__(self):
        self.collection_name = "announcements"

    def get_collection(self):
        return database[self.collection_name]

    async def create(self, data: dict[str, Any]) -> dict[str, Any]:
        collection = self.get_collection()

        result = await collection.insert_one(data)

        created = await collection.find_one(
            {"_id": result.inserted_id}
        )

        return created

    async def get_by_id(
        self,
        announcement_id: str,
    ) -> dict[str, Any] | None:
        from bson import ObjectId

        collection = self.get_collection()

        if not ObjectId.is_valid(announcement_id):
            return None

        return await collection.find_one(
            {"_id": ObjectId(announcement_id)}
        )

    async def update(
        self,
        announcement_id: str,
        data: dict[str, Any],
    ) -> dict[str, Any] | None:
        from bson import ObjectId

        collection = self.get_collection()

        if not ObjectId.is_valid(announcement_id):
            return None

        await collection.update_one(
            {"_id": ObjectId(announcement_id)},
            {"$set": data},
        )

        return await collection.find_one(
            {"_id": ObjectId(announcement_id)}
        )

    async def delete(self, announcement_id: str) -> bool:
        from bson import ObjectId

        collection = self.get_collection()

        if not ObjectId.is_valid(announcement_id):
            return False

        result = await collection.delete_one(
            {"_id": ObjectId(announcement_id)}
        )

        return result.deleted_count > 0

    async def get_published(
        self,
        skip: int = 0,
        limit: int = 10,
        category: str | None = None,
        search: str | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        collection = self.get_collection()

        query: dict[str, Any] = {}

        if category and category.lower() != "all":
            query["category"] = category

        if search:
            query["$or"] = [
                {"title": {"$regex": search, "$options": "i"}},
                {"description": {"$regex": search, "$options": "i"}},
            ]

        total = await collection.count_documents(query)

        cursor = (
            collection.find(query)
            .sort("publish_date", -1)
            .skip(skip)
            .limit(limit)
        )

        announcements = await cursor.to_list(length=limit)

        return announcements, total