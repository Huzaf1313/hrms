from fastapi import APIRouter

from app.db.database import client


router = APIRouter(
    tags=["Health"]
)


@router.get("/health")
async def health_check():
    await client.admin.command("ping")

    return {
        "status": "healthy",
        "database": "connected",
    }