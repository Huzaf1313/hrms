from datetime import datetime

from bson import ObjectId

from app.db.database import database


class SessionRepository:
    collection = database["sessions"]

    async def create(self, session_data: dict):
        result = await self.collection.insert_one(session_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, session_id: str):
        if not ObjectId.is_valid(session_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(session_id)}
        )

    async def get_by_refresh_token(self, refresh_token: str):
        return await self.collection.find_one(
            {"refresh_token": refresh_token}
        )

    async def get_active_by_user_id(self, user_id: str):
        return await self.collection.find(
            {
                "user_id": user_id,
                "is_active": True,
            }
        ).to_list(length=None)

    async def revoke(self, session_id: str):
        if not ObjectId.is_valid(session_id):
            return None

        now = datetime.utcnow()

        await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "is_active": False,
                    "revoked_at": now,
                }
            },
        )

        return await self.get_by_id(session_id)

    async def revoke_by_refresh_token(self, refresh_token: str):
        now = datetime.utcnow()

        await self.collection.update_one(
            {"refresh_token": refresh_token},
            {
                "$set": {
                    "is_active": False,
                    "revoked_at": now,
                }
            },
        )

        return await self.get_by_refresh_token(refresh_token)

    async def update_last_used(self, session_id: str):
        if not ObjectId.is_valid(session_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {
                "$set": {
                    "last_used_at": datetime.utcnow(),
                }
            },
        )

        return await self.get_by_id(session_id)