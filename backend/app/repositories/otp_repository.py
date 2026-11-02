from datetime import datetime, timezone

from app.db.database import database


class OTPRepository:
    collection = database["email_otps"]

    async def create(self, otp_data: dict):
        result = await self.collection.insert_one(otp_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_email(self, email: str):
        return await self.collection.find_one(
            {"email": email.lower()}
        )

    async def get_by_email_and_purpose(self, email: str, purpose: str):
        return await self.collection.find_one(
            {"email": email.lower(), "purpose": purpose}
        )

    async def update(self, email: str, update_data: dict):
        await self.collection.update_one(
            {"email": email.lower()},
            {"$set": update_data},
        )

        return await self.get_by_email(email)

    async def update_by_email_and_purpose(
        self,
        email: str,
        purpose: str,
        update_data: dict,
    ):
        await self.collection.update_one(
            {"email": email.lower(), "purpose": purpose},
            {"$set": update_data},
        )

        return await self.get_by_email_and_purpose(email, purpose)

    async def delete_by_email(self, email: str):
        result = await self.collection.delete_one(
            {"email": email.lower()}
        )

        return result.deleted_count > 0

    async def delete_by_email_and_purpose(self, email: str, purpose: str):
        result = await self.collection.delete_many(
            {"email": email.lower(), "purpose": purpose}
        )

        return result.deleted_count > 0

    async def create_verification_record(self, data: dict):
        result = await self.collection.insert_one(data)
        return await self.collection.find_one({"_id": result.inserted_id})

    async def consume_verification_record(
        self,
        jti: str,
        email: str,
        admin_id: str,
        purpose: str,
    ):
        now = datetime.now(timezone.utc)
        return await self.collection.find_one_and_update(
            {
                "jti": jti,
                "email": email.lower(),
                "admin_id": str(admin_id),
                "purpose": purpose,
                "consumed": False,
                "expires_at": {"$gt": now},
            },
            {
                "$set": {
                    "consumed": True,
                    "consumed_at": now,
                }
            },
        )

    async def count_recent_requests(
        self,
        email: str,
        purpose: str,
        since: datetime,
    ) -> int:
        return await self.collection.count_documents(
            {
                "email": email.lower(),
                "purpose": purpose,
                "created_at": {"$gte": since},
            }
        )

    async def count_recent_admin_requests(
        self,
        admin_id: str,
        purpose: str,
        since: datetime,
    ) -> int:
        return await self.collection.count_documents(
            {
                "admin_id": str(admin_id),
                "purpose": purpose,
                "created_at": {"$gte": since},
            }
        )