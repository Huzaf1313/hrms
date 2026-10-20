from bson import ObjectId

from app.db.database import database


class CandidateRepository:
    collection = database["candidates"]

    async def ensure_indexes(self):
        await self.collection.create_index(
            [("email", 1), ("job_id", 1)],
            unique=True,
            name="unique_candidate_email_per_job",
        )
        await self.collection.create_index(
            "stage",
            name="candidate_stage",
        )
        await self.collection.create_index(
            "job_id",
            name="candidate_job",
        )
        # The dashboard reads booked interviews in chronological order and only
        # ever asks for ones still ahead of now.
        await self.collection.create_index(
            [("interview_scheduled_at", 1)],
            name="candidate_interview_scheduled_at",
        )

    async def create(self, candidate_data: dict):
        result = await self.collection.insert_one(candidate_data)

        return await self.collection.find_one(
            {"_id": result.inserted_id}
        )

    async def get_by_id(self, candidate_id: str):
        if not ObjectId.is_valid(candidate_id):
            return None

        return await self.collection.find_one(
            {"_id": ObjectId(candidate_id)}
        )

    async def get_by_email_and_job(self, email: str, job_id: str):
        return await self.collection.find_one(
            {"email": email, "job_id": job_id}
        )

    async def get_all(
        self,
        filters: dict,
        skip: int,
        limit: int,
        sort_field: str = "applied_at",
    ):
        cursor = (
            self.collection
            .find(filters)
            .sort(sort_field, -1)
            .skip(skip)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def count(self, filters: dict) -> int:
        return await self.collection.count_documents(filters)

    async def update(self, candidate_id: str, update_data: dict):
        if not ObjectId.is_valid(candidate_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": update_data},
        )

        return await self.get_by_id(candidate_id)

    async def update_stage(
        self,
        candidate_id: str,
        stage: str,
        changed_by: str | None,
        now,
    ):
        if not ObjectId.is_valid(candidate_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {
                "$set": {
                    "stage": stage,
                    "stage_updated_at": now,
                    "updated_at": now,
                },
                "$push": {
                    "stage_history": {
                        "stage": stage,
                        "changed_at": now,
                        "changed_by": changed_by,
                    }
                },
            },
        )

        return await self.get_by_id(candidate_id)

    async def update_interview(self, candidate_id: str, when, now):
        """Books or clears the interview slot.

        A None `when` unsets the field, so a cancelled interview stops showing
        on the dashboard without the candidate ever leaving the pipeline.
        """
        if not ObjectId.is_valid(candidate_id):
            return None

        await self.collection.update_one(
            {"_id": ObjectId(candidate_id)},
            {"$set": {"interview_scheduled_at": when, "updated_at": now}},
        )

        return await self.get_by_id(candidate_id)

    async def upcoming_interviews(self, from_time, limit: int):
        """Interviews still ahead of `from_time`, soonest first."""
        cursor = (
            self.collection.find(
                {
                    "interview_scheduled_at": {
                        "$ne": None,
                        "$gte": from_time,
                    }
                }
            )
            .sort("interview_scheduled_at", 1)
            .limit(limit)
        )

        return await cursor.to_list(length=limit)

    async def delete(self, candidate_id: str) -> bool:
        if not ObjectId.is_valid(candidate_id):
            return False

        result = await self.collection.delete_one(
            {"_id": ObjectId(candidate_id)}
        )

        return result.deleted_count > 0

    async def sync_job_details(
        self,
        job_id: str,
        job_title: str,
        department: str,
    ):
        """Candidates keep a copy of their job's title and department so
        lists and reports need no joins; refresh it when the job changes."""
        await self.collection.update_many(
            {"job_id": job_id},
            {"$set": {"job_title": job_title, "department": department}},
        )

    async def stage_counts(self, filters: dict | None = None):
        pipeline = [
            {"$match": filters or {}},
            {"$group": {"_id": "$stage", "count": {"$sum": 1}}},
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)

    async def department_counts(self):
        pipeline = [
            {"$group": {"_id": "$department", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ]

        return await self.collection.aggregate(pipeline).to_list(length=None)
