from app.db.database import database


class PerformanceRepository:
    collection = database["performance_reviews"]

    async def get_summary(self, employee_codes: list[str] | None = None) -> dict:
        query = {}
        if employee_codes is not None:
            query["employee_id"] = {"$in": employee_codes}

        cursor = self.collection.find(query)
        records = await cursor.to_list(length=5000)

        total_reviews = len(records)
        completed = [
            r for r in records
            if r.get("status") in ("completed", "finalized", "approved")
        ]
        pending = [
            r for r in records
            if r.get("status") in ("pending", "in_progress", "submitted")
        ]

        ratings = [
            float(r.get("rating", 0.0))
            for r in completed
            if r.get("rating") is not None
        ]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

        goals_met = [
            r for r in completed
            if r.get("goal_achieved", True)
        ]
        goals_met_pct = round((len(goals_met) / len(completed)) * 100, 1) if completed else 0.0

        return {
            "total_reviews": total_reviews,
            "completed_reviews": len(completed),
            "pending_reviews": len(pending),
            "average_rating": avg_rating,
            "goals_met_pct": goals_met_pct,
            "active_cycle": "Annual Review 2026",
        }
