from bson import ObjectId

from app.db.database import database


class EmployeeRepository:
    collection = database["users"]

    async def create(self, employee_data: dict):
        result = await self.collection.insert_one(employee_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, employee_id: str):
        if not ObjectId.is_valid(employee_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(employee_id)}
        )

    async def get_by_employee_id(self, employee_id: str):
        return await self.collection.find_one(
            {"employee_id": employee_id}
        )

    async def get_by_email(self, email: str):
        return await self.collection.find_one(
            {"email": email}
        )

    async def get_all(
        self,
        filters: dict,
        skip: int,
        limit: int,
    ):
        cursor = (
            self.collection
            .find(filters)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def update(
        self,
        employee_id: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(employee_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(employee_id)

    async def update_status(
        self,
        employee_id: str,
        status: str,
        update_data: dict,
    ):
        if not ObjectId.is_valid(employee_id):
            return None

        update_data["status"] = status

        await self.collection.update_one(
            {"_id": ObjectId(employee_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(employee_id)

    async def delete(self, employee_id: str):
        if not ObjectId.is_valid(employee_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(employee_id)}
        )

        return result.deleted_count > 0