from datetime import datetime, timezone
from app.db.database import database


class LoginHistoryRepository:
    collection = database["login_history"]

    async def record_attempt(
        self,
        *,
        email: str,
        user_id: str | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        status: str,  # "success" | "failed" | "blocked"
        failure_reason: str | None = None,
    ):
        now = datetime.now(timezone.utc)
        data = {
            "email": email.lower().strip(),
            "user_id": user_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "status": status,
            "failure_reason": failure_reason,
            "created_at": now,
        }
        result = await self.collection.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    async def get_by_user_id(self, user_id: str, limit: int = 20):
        cursor = (
            self.collection.find({"user_id": user_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)

    async def get_by_email(self, email: str, limit: int = 20):
        cursor = (
            self.collection.find({"email": email.lower().strip()})
            .sort("created_at", -1)
            .limit(limit)
        )
        return await cursor.to_list(length=limit)
