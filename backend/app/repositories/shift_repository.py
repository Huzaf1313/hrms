from bson import ObjectId

from app.db.database import database


class ShiftRepository:
    collection = database["shifts"]

    async def ensure_indexes(self):
        await self.collection.create_index(
            [("name", 1)],
            unique=True,
            name="unique_shift_name",
        )

    async def create(self, shift_data: dict):
        result = await self.collection.insert_one(shift_data)

        return await self.collection.find_one({"_id": result.inserted_id})

    async def get_by_id(self, shift_id: str):
        if not ObjectId.is_valid(shift_id):
            return None

        return await self.collection.find_one({"_id": ObjectId(shift_id)})

    async def get_by_name(self, name: str):
        return await self.collection.find_one({"name": name})

    async def get_all(self, filters: dict, skip: int = 0, limit: int = 500):
        cursor = (
            self.collection.find(filters).sort("name", 1).skip(skip).limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count(self, filters: dict):
        return await self.collection.count_documents(filters)

    async def update(self, shift_id: str, update_data: dict):
        if not ObjectId.is_valid(shift_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(shift_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(shift_id)

    async def delete(self, shift_id: str):
        if not ObjectId.is_valid(shift_id):
            return False

        result = await self.collection.delete_one({"_id": ObjectId(shift_id)})

        return result.deleted_count > 0
