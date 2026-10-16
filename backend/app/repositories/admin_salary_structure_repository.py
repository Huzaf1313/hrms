import re
from bson import ObjectId

from app.db.database import database


class AdminSalaryStructureRepository:
    collection = database["salary_structures"]

    async def create(self, structure_data: dict):
        result = await self.collection.insert_one(structure_data)
        return await self.collection.find_one({"_id": result.inserted_id})

    async def get_by_id(self, structure_id: str):
        if not ObjectId.is_valid(structure_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(structure_id)}
        )

    async def get_by_name(self, name: str):
        if not name or not name.strip():
            return None

        trimmed = name.strip()
        return await self.collection.find_one(
            {"name": {"$regex": f"^{re.escape(trimmed)}$", "$options": "i"}}
        )

    async def get_all(self, filters: dict, skip: int, limit: int):
        cursor = (
            self.collection
            .find(filters)
            .sort("name", 1)
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

    async def apply_deduction_to_all(self, deduction: dict):
        applied = {
            "id": str(deduction["_id"]),
            "name": deduction.get("name", ""),
            "type": deduction.get("type", "deduction"),
            "calculation_method": deduction.get(
                "calculation_method",
                "percentage_of_basic",
            ),
            "percentage": deduction.get("percentage"),
            "fixed_amount": deduction.get("fixed_amount"),
        }

        # First, update if this deduction id already exists on structures
        await self.collection.update_many(
            {"deductions.id": applied["id"]},
            {"$set": {"deductions.$": applied}},
        )

        # Second, add to any structure where it hasn't been added yet
        result = await self.collection.update_many(
            {"deductions.id": {"$ne": applied["id"]}},
            {"$push": {"deductions": applied}},
        )

        return result.modified_count

