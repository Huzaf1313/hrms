from bson import ObjectId

from app.db.database import database


class DepartmentRepository:
    collection = database["departments"]

    async def create(self, department_data: dict):
        result = await self.collection.insert_one(department_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, department_id: str):
        if not ObjectId.is_valid(department_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(department_id)}
        )

    async def get_all(self, filters: dict, skip: int, limit: int):
        cursor = (
            self.collection
            .find(filters)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def update(self, department_id: str, update_data: dict):
        if not ObjectId.is_valid(department_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(department_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(department_id)

    async def delete(self, department_id: str):
        if not ObjectId.is_valid(department_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(department_id)}
        )

        return result.deleted_count > 0