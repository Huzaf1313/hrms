from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.v1.health import router as health_router
from app.db.database import connect_to_database, close_database_connection


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_database()

    yield

    close_database_connection()


app = FastAPI(
    title="HRMS API",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(
    health_router,
    prefix="/api/v1",
)