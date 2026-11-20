from datetime import date, datetime
from enum import Enum
from typing import Generic, TypeVar

from pydantic import BaseModel, EmailStr, Field, field_validator

T = TypeVar("T")


class JobStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class CandidateStage(str, Enum):
    APPLIED = "applied"
    SCREENING = "screening"
    SHORTLISTED = "shortlisted"
    INTERVIEW = "interview"
    SELECTED = "selected"
    OFFER = "offer"
    HIRED = "hired"
    REJECTED = "rejected"


# Columns shown on the pipeline board, in order ("rejected" is not a column).
PIPELINE_STAGES = [
    CandidateStage.APPLIED.value,
    CandidateStage.SCREENING.value,
    CandidateStage.SHORTLISTED.value,
    CandidateStage.INTERVIEW.value,
    CandidateStage.SELECTED.value,
    CandidateStage.OFFER.value,
    CandidateStage.HIRED.value,
]


class Paginated(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    limit: int


def _clean_skills(value: list[str] | None) -> list[str] | None:
    if value is None:
        return None

    cleaned = [skill.strip() for skill in value if skill and skill.strip()]

    if len(cleaned) > 20:
        raise ValueError("A candidate can have at most 20 skills")

    return cleaned


# ---------------------------------------------------------------- Job positions


class JobPositionCreate(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    department: str = Field(min_length=2, max_length=100)
    location: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    openings: int = Field(default=1, ge=1, le=1000)


class JobPositionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=100)
    department: str | None = Field(default=None, min_length=2, max_length=100)
    location: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=5000)
    openings: int | None = Field(default=None, ge=1, le=1000)
    status: JobStatus | None = None


class JobPositionResponse(BaseModel):
    id: str
    title: str
    department: str
    location: str
    description: str | None = None
    openings: int
    status: JobStatus
    created_at: datetime
    updated_at: datetime


# ------------------------------------------------------------------- Candidates


class CandidateCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    skills: list[str] = Field(default_factory=list)
    experience_years: float | None = Field(default=None, ge=0, le=60)
    job_id: str

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, value):
        return _clean_skills(value)


class CandidateUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    skills: list[str] | None = None
    experience_years: float | None = Field(default=None, ge=0, le=60)

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, value):
        return _clean_skills(value)


class CandidateStageUpdate(BaseModel):
    stage: CandidateStage
    send_rejection_email: bool = False
    rejection_reason: str | None = Field(default=None, max_length=1000)


class InterviewScheduleUpdate(BaseModel):
    # Null clears an existing booking, which is how a cancelled interview is
    # taken off the dashboard without deleting the candidate.
    interview_scheduled_at: datetime | None = None
    meeting_link: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=2000)
    send_email: bool = True


class CandidateOfferCreate(BaseModel):
    offered_salary: float = Field(gt=0, description="Annual CTC in INR")
    joining_date: date
    designation: str | None = Field(default=None, max_length=100)
    work_location: str | None = Field(default=None, max_length=100)
    expiry_date: date | None = None
    notes: str | None = Field(default=None, max_length=2000)
    send_email: bool = True


class CandidateOnboardRequest(BaseModel):
    joining_date: date | None = None
    work_location: str | None = Field(default=None, max_length=100)
    employment_type: str = "Full-time"
    salary_structure: str | None = None
    salary: float | None = None
    manager_id: str | None = None
    reporting_manager: str | None = None
    temporary_password: str | None = Field(default=None, min_length=8, max_length=128)
    send_welcome_email: bool = True


class CandidateResponse(BaseModel):
    id: str
    full_name: str
    email: str
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    experience_years: float | None = None
    job_id: str
    job_title: str
    department: str
    stage: CandidateStage
    resume_file_name: str | None = None
    resume_uploaded_at: datetime | None = None
    applied_at: datetime
    stage_updated_at: datetime
    # Set once HR books the interview. Candidates moved off the interview stage
    # keep it, so the dashboard can still show a completed interview.
    interview_scheduled_at: datetime | None = None
    meeting_link: str | None = None
    # Only set by the change-stage endpoint: True when this change filled the
    # last opening and the job position was closed automatically.
    job_auto_closed: bool = False
    # Onboarding status into Employees
    is_onboarded: bool = False
    employee_id: str | None = None
    employee_code: str | None = None
    onboarded_at: datetime | None = None
    # Offer letter details
    offer_details: dict | None = None


# ---------------------------------------------------------- Pipeline and stats


class PipelineCandidate(BaseModel):
    id: str
    full_name: str
    job_title: str
    stage_updated_at: datetime
    is_onboarded: bool = False
    employee_code: str | None = None
    offer_details: dict | None = None


class PipelineColumn(BaseModel):
    stage: str
    count: int
    candidates: list[PipelineCandidate]


class DepartmentCount(BaseModel):
    department: str
    count: int


class RecruitmentStats(BaseModel):
    total_job_positions: int
    active_job_positions: int
    total_applications: int
    interviews_scheduled: int
    hired_candidates: int
    stage_counts: dict[str, int]
    applications_by_department: list[DepartmentCount]


class UpcomingInterview(BaseModel):
    """One booked interview, as the dashboard's Upcoming Interviews card reads it."""

    id: str
    full_name: str
    job_title: str
    interview_scheduled_at: datetime
