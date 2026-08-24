from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


client = AsyncIOMotorClient(settings.MONGODB_URI)
database = client[settings.DATABASE_NAME]


async def connect_to_database():
    await client.admin.command("ping")

    await database["employee_attendance"].create_index(
        [
            ("employee_id", 1),
            ("date", 1),
        ],
        unique=True,
        name="unique_employee_attendance_per_day",
    )

    print("MongoDB connected successfully")


async def close_database_connection():
    client.close()
    print("MongoDB connection closed")