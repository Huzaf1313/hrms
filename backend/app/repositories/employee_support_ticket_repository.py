from datetime import datetime, timezone
from typing import Any

from bson import ObjectId

from app.db.database import database


class EmployeeSupportTicketRepository:
    """Database operations for employee support tickets."""

    def __init__(self):
        self.collection_name = "employee_support_tickets"

    def get_collection(self):
        return database[self.collection_name]

    async def create(
        self,
        ticket_data: dict[str, Any],
    ) -> dict[str, Any]:
        now = datetime.now(timezone.utc)

        document = {
            **ticket_data,
            "created_at": now,
            "updated_at": now,
        }

        result = await self.get_collection().insert_one(document)

        document["_id"] = result.inserted_id

        return document

    async def get_by_id(
        self,
        ticket_id: str,
        employee_id: str,
    ) -> dict[str, Any] | None:
        if not ObjectId.is_valid(ticket_id):
            return None

        return await self.get_collection().find_one(
            {
                "_id": ObjectId(ticket_id),
                "employee_id": employee_id,
            }
        )

    async def get_by_employee(
        self,
        employee_id: str,
        skip: int = 0,
        limit: int = 10,
    ) -> tuple[list[dict[str, Any]], int]:
        collection = self.get_collection()

        query = {"employee_id": employee_id}

        total = await collection.count_documents(query)

        cursor = (
            collection.find(query)
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )

        tickets = await cursor.to_list(length=limit)

        return tickets, total