from datetime import datetime

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

    async def update(self, email: str, update_data: dict):
        await self.collection.update_one(
            {"email": email.lower()},
            {"$set": update_data},
        )

        return await self.get_by_email(email)

    async def delete_by_email(self, email: str):
        result = await self.collection.delete_one(
            {"email": email.lower()}
        )

        return result.deleted_count > 0