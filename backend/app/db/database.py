import dns.resolver
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import settings


def _use_public_dns_resolvers():
    """Some home routers silently drop dnspython's raw UDP SRV/TXT queries,
    which makes pymongo's mongodb+srv:// resolution time out. Pointing
    dnspython at public resolvers (Google / Cloudflare) avoids this."""
    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = ["8.8.8.8", "1.1.1.1"]
    resolver.lifetime = 10

    dns.resolver.default_resolver = resolver


_use_public_dns_resolvers()

client = AsyncIOMotorClient(
    settings.MONGODB_URI,
    tz_aware=True,
)
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

    await database["email_otps"].create_index(
        "expires_at",
        expireAfterSeconds=0,
        name="email_otp_ttl",
    )

    print("MongoDB connected successfully")


async def close_database_connection():
    client.close()
    print("MongoDB connection closed")