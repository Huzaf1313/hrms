import re
from datetime import datetime, timezone

from app.core.exceptions import AppException
from app.repositories.candidate_repository import CandidateRepository
from app.repositories.job_position_repository import JobPositionRepository
from app.modules.recruitment.schemas import JobStatus
from app.utils.pagination import PaginationParams


class JobPositionService:
    def __init__(self):
        self.repository = JobPositionRepository()
        self.candidate_repository = CandidateRepository()

    async def create_job(self, data: dict, created_by: str | None):
        now = datetime.now(timezone.utc)

        job_data = {
            "title": data["title"].strip(),
            "department": data["department"].strip(),
            "location": data["location"].strip(),
            "description": data.get("description"),
            "openings": data.get("openings", 1),
            "status": JobStatus.ACTIVE.value,
            "created_by": created_by,
            "created_at": now,
            "updated_at": now,
        }

        return await self.repository.create(job_data)

    async def get_job(self, job_id: str):
        job = await self.repository.get_by_id(job_id)

        if not job:
            raise AppException("Job position not found", 404)

        return job

    async def get_jobs(
        self,
        status: str | None,
        search: str | None,
        pagination: PaginationParams,
    ):
        filters: dict = {}

        if status:
            filters["status"] = status

        if search and search.strip():
            pattern = {
                "$regex": re.escape(search.strip()),
                "$options": "i",
            }
            filters["$or"] = [
                {"title": pattern},
                {"department": pattern},
                {"location": pattern},
            ]

        jobs = await self.repository.get_all(
            filters=filters,
            skip=pagination.skip,
            limit=pagination.limit,
        )
        total = await self.repository.count(filters)

        return jobs, total

    async def update_job(self, job_id: str, update_data: dict):
        await self.get_job(job_id)

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }
        update_data["updated_at"] = datetime.now(timezone.utc)

        job = await self.repository.update(job_id, update_data)

        if "title" in update_data or "department" in update_data:
            await self.candidate_repository.sync_job_details(
                job_id,
                job["title"],
                job["department"],
            )

        return job

    async def delete_job(self, job_id: str):
        await self.get_job(job_id)

        applicants = await self.candidate_repository.count(
            {"job_id": job_id}
        )

        if applicants > 0:
            raise AppException(
                "This job position has candidates. Close it instead of deleting it.",
                409,
            )

        await self.repository.delete(job_id)

        return True
