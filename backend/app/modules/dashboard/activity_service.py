import logging
from datetime import datetime, timezone

from bson import ObjectId

from app.repositories.activity_repository import ActivityRepository
from app.repositories.employee_repository import EmployeeRepository
from app.core.scope import visible_employee_codes

logger = logging.getLogger(__name__)


class ActivityService:
    def __init__(self):
        self.repository = ActivityRepository()
        self.employee_repository = EmployeeRepository()

    async def record(
        self,
        *,
        text: str,
        actor: dict | None = None,
        employee_id: str | None = None,
        target: str | None = None,
    ) -> None:
        """Persist an activity without making the source mutation fail."""
        try:
            actor_id = str(actor.get("_id")) if actor and actor.get("_id") else None
            actor_name = (
                (actor or {}).get("full_name")
                or (actor or {}).get("email")
                or "System"
            )

            await self.repository.create(
                {
                    "text": text,
                    "actor_id": actor_id,
                    "actor_name": actor_name,
                    "employee_id": employee_id,
                    "target": target,
                    "created_at": datetime.now(timezone.utc),
                }
            )
        except Exception:
            logger.exception("Failed to record dashboard activity")

    async def recent_for(self, current_user: dict | None, limit: int = 5):
        employee_ids = await visible_employee_codes(
            self.employee_repository,
            current_user,
        )
        actor_id = str(current_user["_id"]) if current_user and current_user.get("_id") else None
        activities = await self.repository.list_recent(
            limit=limit,
            employee_ids=employee_ids,
            actor_id=actor_id,
        )

        return [
            {
                "id": str(activity["_id"])
                if isinstance(activity.get("_id"), ObjectId)
                else str(activity.get("_id", "")),
                "text": activity.get("text", "Activity recorded"),
                "actor_name": activity.get("actor_name", "System"),
                "target": activity.get("target"),
                "created_at": activity.get("created_at"),
            }
            for activity in activities
        ]
