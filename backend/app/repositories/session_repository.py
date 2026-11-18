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

    async def revoke_all_by_user_id(self, user_id: str):
        now = datetime.utcnow()

        await self.collection.update_many(
            {"user_id": user_id, "is_active": True},
            {
                "$set": {
                    "is_active": False,
                    "revoked_at": now,
                }
            },
        )

    async def revoke_others(self, user_id: str, current_session_id: str):
        if not ObjectId.is_valid(current_session_id):
            return 0

        now = datetime.utcnow()

        result = await self.collection.update_many(
            {
                "user_id": user_id,
                "is_active": True,
                "_id": {"$ne": ObjectId(current_session_id)},
            },
            {
                "$set": {
                    "is_active": False,
                    "revoked_at": now,
                }
            },
        )

        return result.modified_count

    async def update_last_used(self, session_id: str, ip_address: str | None = None):
        if not ObjectId.is_valid(session_id):
            return None

        update_fields: dict = {"last_used_at": datetime.utcnow()}
        if ip_address:
            update_fields["ip_address"] = ip_address

        await self.collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_fields},
        )

        return await self.get_by_id(session_id)