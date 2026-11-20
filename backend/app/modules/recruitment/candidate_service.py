import asyncio
import logging
import re
import secrets
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.email_service import EmailService
from app.core.exceptions import AppException
from app.core.roles import UserRole
from app.core.security import hash_password
from app.modules.dashboard.activity_service import ActivityService
from app.modules.employees.identity import next_employee_code
from app.repositories.candidate_repository import CandidateRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.job_position_repository import JobPositionRepository
from app.repositories.user_repository import UserRepository
from app.modules.recruitment.schemas import CandidateStage, JobStatus
from app.utils.pagination import PaginationParams

logger = logging.getLogger(__name__)

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
        self.user_repository = UserRepository()
        self.department_repository = DepartmentRepository()
        self.employee_repository = EmployeeRepository()
        self.email_service = EmailService()
        self.activity_service = ActivityService()

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
        changed_by: str | None = None,
        send_rejection_email: bool = False,
        rejection_reason: str | None = None,
        current_user: dict | None = None,
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

        if stage == CandidateStage.REJECTED.value and send_rejection_email:
            try:
                company_name = (
                    current_user.get("company_name")
                    if current_user and current_user.get("company_name")
                    else "HRMS"
                )
                await self.email_service.send_html_email_async(
                    to_email=candidate["email"],
                    subject=f"Application Update: {candidate['job_title']} at {company_name}",
                    template_name="emails/rejection_notification.html",
                    template_data={
                        "company_name": company_name,
                        "candidate_name": candidate["full_name"],
                        "job_title": candidate["job_title"],
                        "rejection_reason": rejection_reason,
                    },
                )
            except Exception as exc:
                logger.warning(
                    "Rejection email failed to deliver to %s: %s",
                    candidate.get("email"),
                    exc,
                )

        return updated, job_closed

    # ------------------------------------------------------------- Interview
    async def schedule_interview(
        self,
        candidate_id: str,
        when,
        meeting_link: str | None = None,
        notes: str | None = None,
        send_email: bool = True,
        current_user: dict | None = None,
    ):
        """Books or clears a candidate's interview slot.

        Only candidates actually at the interview stage can be booked, so the
        dashboard never advertises an interview for someone still screening.
        Clearing (when=None) is allowed at any stage, because a cancelled
        interview has to come off the list whatever the pipeline moved on to.
        """
        candidate = await self.get_candidate(candidate_id)

        if when is None:
            return await self.repository.update(
                candidate_id,
                {
                    "interview_scheduled_at": None,
                    "meeting_link": None,
                    "updated_at": datetime.now(timezone.utc),
                },
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

        now = datetime.now(timezone.utc)
        updated = await self.repository.update(
            candidate_id,
            {
                "interview_scheduled_at": when,
                "meeting_link": meeting_link,
                "updated_at": now,
            },
        )

        if send_email:
            try:
                company_name = (
                    current_user.get("company_name")
                    if current_user and current_user.get("company_name")
                    else "HRMS"
                )
                formatted_dt = when.strftime("%d %b %Y, %I:%M %p")
                tz_name = str(when.tzinfo)
                await self.email_service.send_html_email_async(
                    to_email=candidate["email"],
                    subject=f"Interview Scheduled: {candidate['job_title']} at {company_name}",
                    template_name="emails/interview_invitation.html",
                    template_data={
                        "company_name": company_name,
                        "candidate_name": candidate["full_name"],
                        "job_title": candidate["job_title"],
                        "department": candidate["department"],
                        "interview_date_time": formatted_dt,
                        "timezone_info": tz_name,
                        "meeting_link": meeting_link,
                        "notes": notes,
                    },
                )
            except Exception as exc:
                logger.warning(
                    "Interview email failed to deliver to %s: %s",
                    candidate.get("email"),
                    exc,
                )

        return updated

    # ----------------------------------------------------------------- Offer
    async def create_offer(
        self,
        candidate_id: str,
        offer_data: dict,
        current_user: dict | None = None,
    ):
        """Issues an offer to the candidate, records offer details and moves to Offer stage."""
        candidate = await self.get_candidate(candidate_id)
        now = datetime.now(timezone.utc)

        designation = offer_data.get("designation") or candidate["job_title"]
        work_location = offer_data.get("work_location") or "Office"
        joining_date_val = offer_data["joining_date"]
        if isinstance(joining_date_val, (date, datetime)):
            joining_date_str = joining_date_val.strftime("%Y-%m-%d")
        else:
            joining_date_str = str(joining_date_val)

        expiry_date_val = offer_data.get("expiry_date")
        expiry_date_str = None
        if expiry_date_val:
            if isinstance(expiry_date_val, (date, datetime)):
                expiry_date_str = expiry_date_val.strftime("%Y-%m-%d")
            else:
                expiry_date_str = str(expiry_date_val)

        offer_dict = {
            "offered_salary": float(offer_data["offered_salary"]),
            "joining_date": joining_date_str,
            "designation": designation,
            "work_location": work_location,
            "expiry_date": expiry_date_str,
            "notes": offer_data.get("notes"),
            "issued_at": now.isoformat(),
            "issued_by": str(current_user["_id"]) if current_user else None,
        }

        # Update candidate with offer details and transition to OFFER stage
        update_fields = {
            "offer_details": offer_dict,
            "stage": CandidateStage.OFFER.value,
            "stage_updated_at": now,
            "updated_at": now,
        }

        updated = await self.repository.update(candidate_id, update_fields)
        await self.repository.collection.update_one(
            {"_id": updated["_id"]},
            {
                "$push": {
                    "stage_history": {
                        "stage": CandidateStage.OFFER.value,
                        "changed_at": now,
                        "changed_by": str(current_user["_id"]) if current_user else None,
                    }
                }
            },
        )

        if offer_data.get("send_email", True):
            try:
                company_name = (
                    current_user.get("company_name")
                    if current_user and current_user.get("company_name")
                    else "HRMS"
                )
                await self.email_service.send_html_email_async(
                    to_email=candidate["email"],
                    subject=f"Job Offer: {designation} at {company_name}",
                    template_name="emails/offer_letter_notification.html",
                    template_data={
                        "company_name": company_name,
                        "candidate_name": candidate["full_name"],
                        "job_title": candidate["job_title"],
                        "designation": designation,
                        "department": candidate["department"],
                        "offered_salary": float(offer_data["offered_salary"]),
                        "joining_date": joining_date_str,
                        "work_location": work_location,
                        "expiry_date": expiry_date_str,
                        "notes": offer_data.get("notes"),
                    },
                )
            except Exception as exc:
                logger.warning(
                    "Offer email failed to deliver to %s: %s",
                    candidate.get("email"),
                    exc,
                )

        return updated

    # ------------------------------------------------------------- Onboarding
    async def onboard_candidate(
        self,
        candidate_id: str,
        onboard_data: dict,
        current_user: dict | None = None,
    ):
        """Converts a hired candidate directly into an active Employee profile."""
        candidate = await self.get_candidate(candidate_id)

        if candidate["stage"] != CandidateStage.HIRED.value:
            raise AppException(
                "Only candidates in the 'Hired' stage can be onboarded as employees",
                400,
            )

        if candidate.get("is_onboarded"):
            raise AppException(
                f"Candidate {candidate['full_name']} has already been onboarded as an employee",
                400,
            )

        # Check if email is already registered in users collection
        existing_user = await self.user_repository.get_by_email(candidate["email"])
        if existing_user:
            raise AppException(
                f"An employee account with email {candidate['email']} already exists",
                400,
            )

        # Resolve department
        department_name = candidate.get("department", "").strip()
        dept = None
        if department_name:
            dept = await self.department_repository.collection.find_one(
                {"name": {"$regex": f"^{re.escape(department_name)}$", "$options": "i"}}
            )
        if not dept:
            dept = await self.department_repository.collection.find_one()

        if not dept:
            dept = await self.department_repository.create({
                "name": department_name or "General",
                "code": (department_name[:3] if department_name else "GEN").upper(),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            })

        department_id = str(dept["_id"])

        # Split full_name into first_name and last_name
        name_parts = candidate["full_name"].strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Generate temporary password or use provided
        temp_password = (
            onboard_data.get("temporary_password")
            or f"Welcome@{secrets.token_hex(4)}"
        )

        emp_code = await next_employee_code(self.employee_repository.collection)
        now = datetime.now(timezone.utc)

        joining_date_val = onboard_data.get("joining_date")
        if not joining_date_val:
            offer = candidate.get("offer_details") or {}
            if offer.get("joining_date"):
                try:
                    joining_date_val = date.fromisoformat(offer["joining_date"])
                except Exception:
                    joining_date_val = date.today()
            else:
                joining_date_val = date.today()
        elif isinstance(joining_date_val, str):
            try:
                joining_date_val = date.fromisoformat(joining_date_val)
            except Exception:
                joining_date_val = date.today()

        employee_doc = {
            "employee_id": emp_code,
            "first_name": first_name,
            "last_name": last_name,
            "full_name": candidate["full_name"],
            "email": candidate["email"].lower().strip(),
            "phone": candidate.get("phone") or "0000000000",
            "phone_number": candidate.get("phone") or "0000000000",
            "password_hash": hash_password(temp_password),
            "role": UserRole.EMPLOYEE.value,
            "status": "active",
            "is_active": True,
            "is_locked": False,
            "failed_login_attempts": 0,
            "department_id": department_id,
            "department_name": dept["name"],
            "designation": candidate["job_title"],
            "joining_date": joining_date_val.isoformat() if isinstance(joining_date_val, (date, datetime)) else str(joining_date_val),
            "employment_type": onboard_data.get("employment_type", "Full-time"),
            "work_location": onboard_data.get("work_location") or "Office",
            "salary_structure": onboard_data.get("salary_structure"),
            "salary": onboard_data.get("salary") or (candidate.get("offer_details") or {}).get("offered_salary"),
            "manager_id": onboard_data.get("manager_id"),
            "reporting_manager": onboard_data.get("reporting_manager"),
            "created_by": str(current_user["_id"]) if current_user else None,
            "created_at": now,
            "updated_at": now,
        }

        created_employee = await self.employee_repository.create(employee_doc)

        # Mark candidate as onboarded
        updated_candidate = await self.repository.update(
            candidate_id,
            {
                "is_onboarded": True,
                "employee_id": str(created_employee["_id"]),
                "employee_code": emp_code,
                "onboarded_at": now,
                "updated_at": now,
            },
        )

        await self.activity_service.record(
            text=f"Candidate {candidate['full_name']} onboarded as employee ({emp_code})",
            actor=current_user,
            employee_id=emp_code,
            target="/dashboard/employees",
        )

        if onboard_data.get("send_welcome_email", True):
            try:
                company_name = (
                    current_user.get("company_name")
                    if current_user and current_user.get("company_name")
                    else "HRMS"
                )
                await self.email_service.send_html_email_async(
                    to_email=candidate["email"],
                    subject=f"Welcome to {company_name}!",
                    template_name="emails/welcome_email.html",
                    template_data={
                        "company_name": company_name,
                        "employee_name": candidate["full_name"],
                        "hr_team": "HR Team",
                        "login_url": settings.login_url,
                    },
                )
            except Exception as exc:
                logger.warning(
                    "Welcome email could not be delivered to %s: %s",
                    candidate.get("email"),
                    exc,
                )

        return updated_candidate, created_employee, temp_password

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
