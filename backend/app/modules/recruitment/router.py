from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import require_permission
from app.core.roles import Permission
from app.core.common_schemas import APIResponse
from app.modules.recruitment.schemas import (
    CandidateCreate,
    CandidateOfferCreate,
    CandidateOnboardRequest,
    CandidateResponse,
    CandidateStage,
    CandidateStageUpdate,
    CandidateUpdate,
    InterviewScheduleUpdate,
    JobPositionCreate,
    JobPositionResponse,
    JobPositionUpdate,
    JobStatus,
    Paginated,
    PipelineCandidate,
    PipelineColumn,
    RecruitmentStats,
    UpcomingInterview,
)
from app.modules.recruitment.candidate_service import CandidateService
from app.modules.recruitment.job_position_service import JobPositionService
from app.modules.recruitment.stats_service import RecruitmentStatsService
from app.utils.pagination import PaginationParams


router = APIRouter(
    prefix="/recruitment",
    tags=["Recruitment"],
)

job_service = JobPositionService()
candidate_service = CandidateService()
stats_service = RecruitmentStatsService()


def serialize_job(job: dict) -> JobPositionResponse:
    return JobPositionResponse(
        id=str(job["_id"]),
        title=job["title"],
        department=job["department"],
        location=job["location"],
        description=job.get("description"),
        openings=job.get("openings", 1),
        status=job["status"],
        created_at=job["created_at"],
        updated_at=job["updated_at"],
    )


def serialize_candidate(candidate: dict) -> CandidateResponse:
    resume = candidate.get("resume") or {}

    return CandidateResponse(
        id=str(candidate["_id"]),
        full_name=candidate["full_name"],
        email=candidate["email"],
        phone=candidate.get("phone"),
        skills=candidate.get("skills", []),
        experience_years=candidate.get("experience_years"),
        job_id=candidate["job_id"],
        job_title=candidate["job_title"],
        department=candidate["department"],
        stage=candidate["stage"],
        resume_file_name=resume.get("file_name"),
        resume_uploaded_at=resume.get("uploaded_at"),
        applied_at=candidate["applied_at"],
        stage_updated_at=candidate["stage_updated_at"],
        interview_scheduled_at=candidate.get("interview_scheduled_at"),
        meeting_link=candidate.get("meeting_link"),
        is_onboarded=candidate.get("is_onboarded", False),
        employee_id=str(candidate["employee_id"]) if candidate.get("employee_id") else None,
        employee_code=candidate.get("employee_code"),
        onboarded_at=candidate.get("onboarded_at"),
        offer_details=candidate.get("offer_details"),
    )


# ------------------------------------------------------------- Job positions


@router.post(
    "/jobs",
    response_model=APIResponse[JobPositionResponse],
)
async def create_job(
    data: JobPositionCreate,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_CREATE)),
):
    job = await job_service.create_job(
        data.model_dump(),
        created_by=str(current_user["_id"]),
    )

    return APIResponse(
        success=True,
        message="Job position created successfully",
        data=serialize_job(job),
    )


@router.get(
    "/jobs",
    response_model=APIResponse[Paginated[JobPositionResponse]],
)
async def get_jobs(
    status: JobStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    jobs, total = await job_service.get_jobs(
        status=status.value if status else None,
        search=search,
        pagination=PaginationParams(page=page, limit=limit),
    )

    return APIResponse(
        success=True,
        message="Job positions retrieved successfully",
        data=Paginated(
            items=[serialize_job(job) for job in jobs],
            total=total,
            page=page,
            limit=limit,
        ),
    )


@router.get(
    "/jobs/{job_id}",
    response_model=APIResponse[JobPositionResponse],
)
async def get_job(
    job_id: str,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    job = await job_service.get_job(job_id)

    return APIResponse(
        success=True,
        message="Job position retrieved successfully",
        data=serialize_job(job),
    )


@router.put(
    "/jobs/{job_id}",
    response_model=APIResponse[JobPositionResponse],
)
async def update_job(
    job_id: str,
    data: JobPositionUpdate,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_UPDATE)),
):
    job = await job_service.update_job(
        job_id,
        data.model_dump(exclude_none=True, mode="json"),
    )

    return APIResponse(
        success=True,
        message="Job position updated successfully",
        data=serialize_job(job),
    )


@router.delete(
    "/jobs/{job_id}",
    response_model=APIResponse[None],
)
async def delete_job(
    job_id: str,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_DELETE)),
):
    await job_service.delete_job(job_id)

    return APIResponse(
        success=True,
        message="Job position deleted successfully",
        data=None,
    )


# ---------------------------------------------------------------- Candidates


@router.post(
    "/candidates",
    response_model=APIResponse[CandidateResponse],
)
async def create_candidate(
    data: CandidateCreate,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_CREATE)),
):
    candidate = await candidate_service.create_candidate(data.model_dump())

    return APIResponse(
        success=True,
        message="Candidate added successfully",
        data=serialize_candidate(candidate),
    )


@router.get(
    "/candidates",
    response_model=APIResponse[Paginated[CandidateResponse]],
)
async def get_candidates(
    search: str | None = Query(default=None),
    stage: CandidateStage | None = Query(default=None),
    job_id: str | None = Query(default=None),
    has_resume: bool | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    candidates, total = await candidate_service.get_candidates(
        search=search,
        stage=stage.value if stage else None,
        job_id=job_id,
        has_resume=has_resume,
        pagination=PaginationParams(page=page, limit=limit),
    )

    return APIResponse(
        success=True,
        message="Candidates retrieved successfully",
        data=Paginated(
            items=[serialize_candidate(c) for c in candidates],
            total=total,
            page=page,
            limit=limit,
        ),
    )


@router.get(
    "/candidates/{candidate_id}",
    response_model=APIResponse[CandidateResponse],
)
async def get_candidate(
    candidate_id: str,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    candidate = await candidate_service.get_candidate(candidate_id)

    return APIResponse(
        success=True,
        message="Candidate retrieved successfully",
        data=serialize_candidate(candidate),
    )


@router.put(
    "/candidates/{candidate_id}",
    response_model=APIResponse[CandidateResponse],
)
async def update_candidate(
    candidate_id: str,
    data: CandidateUpdate,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_UPDATE)),
):
    candidate = await candidate_service.update_candidate(
        candidate_id,
        data.model_dump(exclude_none=True),
    )

    return APIResponse(
        success=True,
        message="Candidate updated successfully",
        data=serialize_candidate(candidate),
    )


@router.patch(
    "/candidates/{candidate_id}/stage",
    response_model=APIResponse[CandidateResponse],
)
async def change_candidate_stage(
    candidate_id: str,
    data: CandidateStageUpdate,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_UPDATE)),
):
    candidate, job_closed = await candidate_service.change_stage(
        candidate_id,
        data.stage.value,
        changed_by=str(current_user["_id"]),
        send_rejection_email=data.send_rejection_email,
        rejection_reason=data.rejection_reason,
        current_user=current_user,
    )

    result = serialize_candidate(candidate)
    result.job_auto_closed = job_closed

    return APIResponse(
        success=True,
        message=(
            "Candidate stage updated. All openings are filled, so the job position was closed."
            if job_closed
            else "Candidate stage updated successfully"
        ),
        data=result,
    )


@router.delete(
    "/candidates/{candidate_id}",
    response_model=APIResponse[None],
)
async def delete_candidate(
    candidate_id: str,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_DELETE)),
):
    await candidate_service.delete_candidate(candidate_id)

    return APIResponse(
        success=True,
        message="Candidate deleted successfully",
        data=None,
    )


# ------------------------------------------------------------------ Interviews


@router.patch(
    "/candidates/{candidate_id}/interview",
    response_model=APIResponse[CandidateResponse],
)
async def schedule_candidate_interview(
    candidate_id: str,
    data: InterviewScheduleUpdate,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_UPDATE)),
):
    candidate = await candidate_service.schedule_interview(
        candidate_id,
        data.interview_scheduled_at,
        meeting_link=data.meeting_link,
        notes=data.notes,
        send_email=data.send_email,
        current_user=current_user,
    )

    scheduled = candidate.get("interview_scheduled_at")

    return APIResponse(
        success=True,
        message=(
            "Interview scheduled successfully"
            if scheduled
            else "Interview cancelled"
        ),
        data=serialize_candidate(candidate),
    )


# ----------------------------------------------------------------------- Offer


@router.post(
    "/candidates/{candidate_id}/offer",
    response_model=APIResponse[CandidateResponse],
)
async def issue_candidate_offer(
    candidate_id: str,
    data: CandidateOfferCreate,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_UPDATE)),
):
    candidate = await candidate_service.create_offer(
        candidate_id,
        data.model_dump(),
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Job offer issued and sent to candidate successfully",
        data=serialize_candidate(candidate),
    )


# ------------------------------------------------------------------ Onboarding


@router.post(
    "/candidates/{candidate_id}/onboard",
    response_model=APIResponse[CandidateResponse],
)
async def onboard_candidate(
    candidate_id: str,
    data: CandidateOnboardRequest,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_UPDATE)),
):
    candidate, employee, temp_pw = await candidate_service.onboard_candidate(
        candidate_id,
        data.model_dump(),
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message=f"Candidate successfully onboarded as employee {employee['employee_id']}",
        data=serialize_candidate(candidate),
    )


@router.get(
    "/interviews/upcoming",
    response_model=APIResponse[list[UpcomingInterview]],
)
async def get_upcoming_interviews(
    limit: int = Query(default=6, ge=1, le=50),
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    """Interviews still ahead of now, soonest first.

    Feeds the admin dashboard's Upcoming Interviews card.
    """
    interviews = await candidate_service.get_upcoming_interviews(limit)

    return APIResponse(
        success=True,
        message="Upcoming interviews retrieved successfully",
        data=[
            UpcomingInterview(
                id=str(candidate["_id"]),
                full_name=candidate["full_name"],
                job_title=candidate["job_title"],
                interview_scheduled_at=candidate["interview_scheduled_at"],
            )
            for candidate in interviews
        ],
    )


# -------------------------------------------------------------------- Resume


@router.post(
    "/candidates/{candidate_id}/resume",
    response_model=APIResponse[CandidateResponse],
)
async def upload_resume(
    candidate_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_UPDATE)),
):
    candidate = await candidate_service.upload_resume(candidate_id, file)

    return APIResponse(
        success=True,
        message="Resume uploaded successfully",
        data=serialize_candidate(candidate),
    )


@router.get("/candidates/{candidate_id}/resume")
async def download_resume(
    candidate_id: str,
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    path, file_name, mime_type = await candidate_service.get_resume_file(
        candidate_id
    )

    return FileResponse(
        path,
        media_type=mime_type,
        filename=file_name,
    )


# ------------------------------------------------------- Pipeline and reports


@router.get(
    "/stats",
    response_model=APIResponse[RecruitmentStats],
)
async def get_recruitment_stats(
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    stats = await stats_service.get_stats()

    return APIResponse(
        success=True,
        message="Recruitment stats retrieved successfully",
        data=RecruitmentStats(**stats),
    )


@router.get(
    "/pipeline",
    response_model=APIResponse[list[PipelineColumn]],
)
async def get_pipeline(
    job_id: str | None = Query(default=None),
    per_column: int = Query(default=3, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.RECRUITMENT_READ)),
):
    columns = await stats_service.get_pipeline(job_id, per_column)

    return APIResponse(
        success=True,
        message="Recruitment pipeline retrieved successfully",
        data=[
            PipelineColumn(
                stage=column["stage"],
                count=column["count"],
                candidates=[
                    PipelineCandidate(
                        id=str(candidate["_id"]),
                        full_name=candidate["full_name"],
                        job_title=candidate["job_title"],
                        stage_updated_at=candidate["stage_updated_at"],
                        is_onboarded=candidate.get("is_onboarded", False),
                        employee_code=candidate.get("employee_code"),
                        offer_details=candidate.get("offer_details"),
                    )
                    for candidate in column["candidates"]
                ],
            )
            for column in columns
        ],
    )
