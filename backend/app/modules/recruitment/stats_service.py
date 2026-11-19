from app.repositories.candidate_repository import CandidateRepository
from app.repositories.job_position_repository import JobPositionRepository
from app.modules.recruitment.schemas import CandidateStage, PIPELINE_STAGES


class RecruitmentStatsService:
    def __init__(self):
        self.candidate_repository = CandidateRepository()
        self.job_repository = JobPositionRepository()

    async def get_stats(self):
        stage_counts = {stage.value: 0 for stage in CandidateStage}

        for row in await self.candidate_repository.stage_counts():
            if row["_id"] in stage_counts:
                stage_counts[row["_id"]] = row["count"]

        departments = [
            {"department": row["_id"] or "Unassigned", "count": row["count"]}
            for row in await self.candidate_repository.department_counts()
        ]

        return {
            "total_job_positions": await self.job_repository.count({}),
            "active_job_positions": await self.job_repository.count(
                {"status": "active"}
            ),
            "total_applications": sum(stage_counts.values()),
            "interviews_scheduled": stage_counts[CandidateStage.INTERVIEW.value],
            "hired_candidates": stage_counts[CandidateStage.HIRED.value],
            "stage_counts": stage_counts,
            "applications_by_department": departments,
        }

    async def get_pipeline(self, job_id: str | None, per_column: int = 3):
        base_filter = {"job_id": job_id} if job_id else {}
        columns = []

        for stage in PIPELINE_STAGES:
            stage_filter = {**base_filter, "stage": stage}

            count = await self.candidate_repository.count(stage_filter)
            candidates = await self.candidate_repository.get_all(
                filters=stage_filter,
                skip=0,
                limit=per_column,
                sort_field="stage_updated_at",
            )

            columns.append(
                {
                    "stage": stage,
                    "count": count,
                    "candidates": candidates,
                }
            )

        return columns
