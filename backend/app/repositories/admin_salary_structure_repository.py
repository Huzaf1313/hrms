from bson import ObjectId

from app.db.database import database


class AdminSalaryStructureRepository:
    collection = database["salary_structures"]

    async def create(self, structure_data: dict):
        result = await self.collection.insert_one(structure_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, structure_id: str):
        if not ObjectId.is_valid(structure_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(structure_id)}
        )

    async def get_all(self, filters: dict, skip: int, limit: int):
        cursor = (
            self.collection
            .find(filters)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def update(self, structure_id: str, update_data: dict):
        if not ObjectId.is_valid(structure_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(structure_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(structure_id)

    async def delete(self, structure_id: str):
        if not ObjectId.is_valid(structure_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(structure_id)}
        )

        return result.deleted_count > 0
