from bson import ObjectId

from app.db.database import database


class AdminDeductionRepository:
    collection = database["deductions_contributions"]

    async def create(self, deduction_data: dict):
        result = await self.collection.insert_one(deduction_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, deduction_id: str):
        if not ObjectId.is_valid(deduction_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(deduction_id)}
        )

    async def get_all(self, filters: dict, skip: int, limit: int):
        cursor = (
            self.collection
            .find(filters)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def update(self, deduction_id: str, update_data: dict):
        if not ObjectId.is_valid(deduction_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(deduction_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(deduction_id)

    async def delete(self, deduction_id: str):
        if not ObjectId.is_valid(deduction_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(deduction_id)}
        )

        return result.deleted_count > 0