from datetime import date
from typing import Any

from bson import ObjectId

from app.db.database import database

ALL_EMPLOYEES = "All Employees"
DEPARTMENT_WISE = "Department-wise"
CUSTOM = "Custom"


class EmployeeAnnouncementRepository:
    """Read-only view over the `announcements` collection.

    Announcements are authored by HR through the admin API, which writes to
    `announcements`. Employees read the same documents, narrowed to the ones
    their audience actually targets.
    """

    def __init__(self):
        self.collection_name = "announcements"

    def get_collection(self):
        return database[self.collection_name]

    @staticmethod
    def _visibility_clause(
        user_id: str | None,
        department_id: str | None,
    ) -> dict[str, Any]:
        """Match announcements this specific user is allowed to see.

        An announcement is visible when it targets everyone, when it targets
        the viewer's department, or when it targets the viewer by id.
        Documents written before the `audience` field existed have no value, so
        they are treated as company-wide rather than silently disappearing.
        """
        clauses: list[dict[str, Any]] = [
            {"audience": ALL_EMPLOYEES},
            {"audience": {"$exists": False}},
            {"audience": None},
        ]

        if department_id:
            clauses.append(
                {
                    "audience": DEPARTMENT_WISE,
                    "target_departments": department_id,
                }
            )

        if user_id:
            clauses.append(
                {
                    "audience": CUSTOM,
                    "target_employees": user_id,
                }
            )

        return {"$or": clauses}

    async def get_by_id(
        self,
        announcement_id: str,
        user_id: str | None = None,
        department_id: str | None = None,
    ) -> dict[str, Any] | None:
        """Fetch one announcement, but only if it is visible to this user."""
        if not ObjectId.is_valid(announcement_id):
            return None

        current_day = date.today().isoformat()

        query: dict[str, Any] = {
            "_id": ObjectId(announcement_id),
            "$and": [
                self._visibility_clause(user_id, department_id),
                {"publish_date": {"$lte": current_day}},
                {
                    "$or": [
                        {"expiry_date": None},
                        {"expiry_date": {"$gte": current_day}},
                    ]
                },
            ],
        }

        return await self.get_collection().find_one(query)

    async def get_visible(
        self,
        user_id: str | None,
        department_id: str | None,
        skip: int = 0,
        limit: int = 10,
        category: str | None = None,
        search: str | None = None,
        pinned: bool | None = None,
        today: date | None = None,
    ) -> tuple[list[dict[str, Any]], int]:
        collection = self.get_collection()
        current_day = (today or date.today()).isoformat()

        conditions: list[dict[str, Any]] = [
            self._visibility_clause(user_id, department_id),
            # Not yet published.
            {"publish_date": {"$lte": current_day}},
            # Not expired. A null expiry_date matches here as well.
            {
                "$or": [
                    {"expiry_date": None},
                    {"expiry_date": {"$gte": current_day}},
                ]
            },
        ]

        if category and category.lower() != "all":
            conditions.append({"category": category})

        if search:
            conditions.append(
                {
                    "$or": [
                        {"title": {"$regex": search, "$options": "i"}},
                        {"description": {"$regex": search, "$options": "i"}},
                    ]
                }
            )

        if pinned is not None:
            conditions.append({"pinned": pinned})

        query: dict[str, Any] = {"$and": conditions}

        total = await collection.count_documents(query)

        cursor = (
            collection.find(query)
            .sort([("pinned", -1), ("publish_date", -1), ("created_at", -1)])
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit), total
