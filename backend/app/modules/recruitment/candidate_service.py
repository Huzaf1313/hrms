import asyncio
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from pymongo.errors import DuplicateKeyError

from app.core.exceptions import AppException
from app.repositories.candidate_repository import CandidateRepository
from app.repositories.job_position_repository import JobPositionRepository
from app.modules.recruitment.schemas import CandidateStage, JobStatus
from app.utils.pagination import PaginationParams

# Resumes are private. They live OUTSIDE the public /uploads folder and are
# only ever served through the authenticated download route.
RESUME_DIR = (
    Path(__file__).resolve().parents[2] / "private_uploads" / "resumes"
)
MAX_RESUME_BYTES = 5 * 1024 * 1024

# extension -> (expected first bytes of the file, mime type)
ALLOWED_RESUME_TYPES = {
    ".pdf": (b"%PDF", "application/pdf"),
    ".docx": (
        b"PK\x03\x04",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
    ".doc": (b"\xd0\xcf\x11\xe0", "application/msword"),
}


class CandidateService:
    def __init__(self):
        self.repository = CandidateRepository()
        self.job_repository = JobPositionRepository()

    async def create_candidate(self, data: dict):
        job = await self.job_repository.get_by_id(data["job_id"])

        if not job:
            raise AppException("Job position not found", 404)

        if job.get("status") != JobStatus.ACTIVE.value:
            raise AppException("This job position is closed", 400)

        email = data["email"].lower().strip()

        existing = await self.repository.get_by_email_and_job(
            email,
            data["job_id"],
        )

        if existing:
            raise AppException(
                "This candidate has already applied for this job position",
                409,
            )

        now = datetime.now(timezone.utc)

        candidate_data = {
            "full_name": data["full_name"].strip(),
            "email": email,
            "phone": data.get("phone"),
            "skills": data.get("skills", []),
            "experience_years": data.get("experience_years"),
            "job_id": data["job_id"],
            "job_title": job["title"],
            "department": job["department"],
            "stage": CandidateStage.APPLIED.value,
            "stage_history": [
                {
                    "stage": CandidateStage.APPLIED.value,
                    "changed_at": now,
                    "changed_by": None,
                }
            ],
            "resume": None,
            "applied_at": now,
            "stage_updated_at": now,
            "created_at": now,
            "updated_at": now,
        }

        try:
            return await self.repository.create(candidate_data)
        except DuplicateKeyError:
            raise AppException(
                "This candidate has already applied for this job position",
                409,
            )

    async def get_candidate(self, candidate_id: str):
        candidate = await self.repository.get_by_id(candidate_id)

        if not candidate:
            raise AppException("Candidate not found", 404)

        return candidate

    async def get_candidates(
        self,
        search: str | None,
        stage: str | None,
        job_id: str | None,
        has_resume: bool | None,
        pagination: PaginationParams,
    ):
        filters: dict = {}

        if stage:
            filters["stage"] = stage

        if job_id:
            filters["job_id"] = job_id

        if has_resume is True:
            filters["resume"] = {"$ne": None}
        elif has_resume is False:
            filters["resume"] = None

        if search and search.strip():
            pattern = {
                "$regex": re.escape(search.strip()),
                "$options": "i",
            }
            filters["$or"] = [
                {"full_name": pattern},
                {"email": pattern},
                {"skills": pattern},
                {"job_title": pattern},
            ]

        candidates = await self.repository.get_all(
            filters=filters,
            skip=pagination.skip,
            limit=pagination.limit,
        )
        total = await self.repository.count(filters)

        return candidates, total

    async def update_candidate(self, candidate_id: str, update_data: dict):
        await self.get_candidate(candidate_id)

        update_data = {
            key: value
            for key, value in update_data.items()
            if value is not None
        }
        update_data["updated_at"] = datetime.now(timezone.utc)

        return await self.repository.update(candidate_id, update_data)

    async def change_stage(
        self,
        candidate_id: str,
        stage: str,
        changed_by: str | None,
    ):
        """Returns (candidate, job_auto_closed)."""
        candidate = await self.get_candidate(candidate_id)

        if candidate["stage"] == stage:
            return candidate, False

        updated = await self.repository.update_stage(
            candidate_id,
            stage,
            changed_by,
            datetime.now(timezone.utc),
        )

        job_closed = False

        if stage == CandidateStage.HIRED.value:
            job_closed = await self._close_job_if_filled(candidate["job_id"])

        return updated, job_closed

    # ------------------------------------------------------------- Interview
    async def schedule_interview(self, candidate_id: str, when):
        """Books or clears a candidate's interview slot.

        Only candidates actually at the interview stage can be booked, so the
        dashboard never advertises an interview for someone still screening.
        Clearing (when=None) is allowed at any stage, because a cancelled
        interview has to come off the list whatever the pipeline moved on to.
        """
        candidate = await self.get_candidate(candidate_id)

        if when is None:
            return await self.repository.update_interview(
                candidate_id,
                None,
                datetime.now(timezone.utc),
            )

        if candidate["stage"] != CandidateStage.INTERVIEW.value:
            raise AppException(
                "Move the candidate to the Interview stage before scheduling",
                400,
            )

        # The client sends whatever its own timezone offset implies, so this is
        # already an absolute instant. A naive value would be read as UTC and
        # land hours off, which is worse than rejecting it outright.
        if when.tzinfo is None:
            raise AppException(
                "Interview time must include a timezone offset", 400
            )

        if when <= datetime.now(timezone.utc):
            raise AppException("Interview time must be in the future", 400)

        return await self.repository.update_interview(
            candidate_id,
            when,
            datetime.now(timezone.utc),
        )

    async def get_upcoming_interviews(self, limit: int):
        now = datetime.now(timezone.utc)

        return await self.repository.upcoming_interviews(now, limit)

    async def _close_job_if_filled(self, job_id: str) -> bool:
        """Close the job once the number of hired candidates reaches its
        number of openings. Reopening it later is still a manual action."""
        job = await self.job_repository.get_by_id(job_id)

        if not job or job.get("status") != JobStatus.ACTIVE.value:
            return False

        hired = await self.repository.count(
            {"job_id": job_id, "stage": CandidateStage.HIRED.value}
        )

        if hired < job.get("openings", 1):
            return False

        await self.job_repository.update(
            job_id,
            {
                "status": JobStatus.CLOSED.value,
                "updated_at": datetime.now(timezone.utc),
            },
        )

        return True

    async def delete_candidate(self, candidate_id: str):
        candidate = await self.get_candidate(candidate_id)

        await self.repository.delete(candidate_id)

        resume = candidate.get("resume")

        if resume:
            self._remove_resume_file(resume.get("stored_name"))

        return True

    # ---------------------------------------------------------------- Resume

    async def upload_resume(self, candidate_id: str, file: UploadFile):
        candidate = await self.get_candidate(candidate_id)

        # .name drops any folder part a client might send in the filename.
        original_name = Path(file.filename or "resume").name
        extension = Path(original_name).suffix.lower()

        if extension not in ALLOWED_RESUME_TYPES:
            raise AppException(
                "Only PDF, DOC or DOCX resumes are allowed",
                400,
            )

        content = await file.read(MAX_RESUME_BYTES + 1)

        if not content:
            raise AppException("The uploaded file is empty", 400)

        if len(content) > MAX_RESUME_BYTES:
            raise AppException("Resume must be 5 MB or smaller", 413)

        signature, mime_type = ALLOWED_RESUME_TYPES[extension]

        if not content.startswith(signature):
            raise AppException(
                "The file content does not match its extension",
                400,
            )

        RESUME_DIR.mkdir(parents=True, exist_ok=True)

        # The stored name is generated here, never taken from the client.
        stored_name = f"{candidate_id}_{uuid.uuid4().hex}{extension}"

        await asyncio.to_thread(
            (RESUME_DIR / stored_name).write_bytes,
            content,
        )

        now = datetime.now(timezone.utc)

        resume = {
            "file_name": original_name,
            "stored_name": stored_name,
            "mime_type": mime_type,
            "size": len(content),
            "uploaded_at": now,
        }

        previous = candidate.get("resume")

        updated = await self.repository.update(
            candidate_id,
            {"resume": resume, "updated_at": now},
        )

        if previous:
            self._remove_resume_file(previous.get("stored_name"))

        return updated

    async def get_resume_file(self, candidate_id: str):
        candidate = await self.get_candidate(candidate_id)
        resume = candidate.get("resume")

        if not resume:
            raise AppException("No resume uploaded for this candidate", 404)

        path = RESUME_DIR / resume["stored_name"]

        if not path.is_file():
            raise AppException("Resume file is missing on the server", 404)

        return path, resume["file_name"], resume["mime_type"]

    @staticmethod
    def _remove_resume_file(stored_name: str | None):
        if not stored_name:
            return

        path = RESUME_DIR / stored_name

        try:
            path.unlink(missing_ok=True)
        except OSError:
            pass
