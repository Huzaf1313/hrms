from bson import ObjectId

from app.db.database import database


class JobPositionRepository:
    collection = database["job_positions"]

    async def ensure_indexes(self):
        await self.collection.create_index(
            "status",
            name="job_position_status",
        )

    async def create(self, job_data: dict):
        result = await self.collection.insert_one(job_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, job_id: str):
        if not ObjectId.is_valid(job_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(job_id)}
        )

    async def get_all(self, filters: dict, skip: int, limit: int):
        cursor = (
            self.collection
            .find(filters)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count(self, filters: dict) -> int:
        return await self.collection.count_documents(filters)

    async def update(self, job_id: str, update_data: dict):
        if not ObjectId.is_valid(job_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(job_id)

    async def delete(self, job_id: str) -> bool:
        if not ObjectId.is_valid(job_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(job_id)}
        )

        return result.deleted_count > 0
