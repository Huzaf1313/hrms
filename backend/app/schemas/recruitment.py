from datetime import datetime
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
    # Only set by the change-stage endpoint: True when this change filled the
    # last opening and the job position was closed automatically.
    job_auto_closed: bool = False


# ---------------------------------------------------------- Pipeline and stats


class PipelineCandidate(BaseModel):
    id: str
    full_name: str
    job_title: str
    stage_updated_at: datetime


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
