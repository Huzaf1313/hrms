from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


client = AsyncIOMotorClient(settings.MONGODB_URI)

database = client[settings.DATABASE_NAME]

async def connect_to_database():
    await client.admin.command("ping")
    print("MongoDB connected successfully")


async def close_database_connection():
    client.close()
    print("MongoDB connection closed")