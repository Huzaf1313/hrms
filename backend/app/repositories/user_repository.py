from bson import ObjectId

from app.core.roles import UserRole
from app.db.database import database


class UserRepository:
    collection = database["users"]

    async def create(self, user_data: dict):
        result = await self.collection.insert_one(user_data)
        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_admin_accounts(self):
        """Admin-level accounts (HR / manager) available as reporting managers."""
        return await (
            self.collection.find(
                {
                    "role": {
                        "$in": [
                            UserRole.HR_ADMIN.value,
                            UserRole.MANAGER.value,
                        ]
                    },
                    "is_active": True,
                    "is_locked": False,
                }
            )
            .sort("full_name", 1)
            .to_list(length=200)
        )


    async def get_by_id(self, user_id: str):
        if not ObjectId.is_valid(user_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(user_id)}
        )

    async def get_by_email(self, email: str):
        return await self.collection.find_one(
            {"email": email.lower()}
        )

    async def update(self, user_id: str, update_data: dict):
        if not ObjectId.is_valid(user_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(user_id)

    async def delete(self, user_id: str):
        if not ObjectId.is_valid(user_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(user_id)}
        )

        return result.deleted_count > 0