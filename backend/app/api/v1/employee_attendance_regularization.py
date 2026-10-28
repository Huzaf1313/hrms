from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_permission
from app.core.cache import (
    get_cache,
    invalidate_attendance_cache,
    invalidate_attendance_regularization_cache,
    set_cache,
)
from app.core.exceptions import AppException
from app.core.roles import Permission
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.common import APIResponse
from app.schemas.employee_attendance_regularization import (
    AttendanceRegularizationCreate,
    AttendanceRegularizationResponse,
    AttendanceRegularizationReview,
)
from app.services.employee_attendance_regularization_service import (
    EmployeeAttendanceRegularizationService,
)

REGULARIZATION_LIST_CACHE_TTL = 60
REGULARIZATION_DETAIL_CACHE_TTL = 120

router = APIRouter()

service = EmployeeAttendanceRegularizationService()
employee_repository = EmployeeRepository()


async def serialize_regularization(
    regularization: dict,
) -> AttendanceRegularizationResponse:
    attendance = await service.attendance_repository.get_by_id(
        regularization["attendance_id"]
    )
    employee = await employee_repository.get_by_employee_id(
        regularization["employee_id"]
    )

    request_date = regularization["date"]
    if hasattr(request_date, "date"):
        request_date = request_date.date()

    return AttendanceRegularizationResponse(
        id=str(regularization["_id"]),
        employee_id=regularization["employee_id"],
        attendance_id=regularization["attendance_id"],
        date=request_date,
        issue_type=regularization["issue_type"],
        requested_check_in=regularization.get(
            "requested_check_in"
        ),
        requested_check_out=regularization.get(
            "requested_check_out"
        ),
        reason=regularization["reason"],
        status=regularization["status"],
        requested_at=regularization["requested_at"],
        reviewed_at=regularization.get("reviewed_at"),
        reviewed_by=regularization.get("reviewed_by"),
        created_at=regularization["created_at"],
        updated_at=regularization["updated_at"],
        current_check_in=(
            (attendance.get("check_in") or attendance.get("in_time"))
            if attendance
            else None
        ),
        current_check_out=(
            (attendance.get("check_out") or attendance.get("out_time"))
            if attendance
            else None
        ),
        employee_name=(
            employee.get("full_name")
            or " ".join(
                part
                for part in (
                    employee.get("first_name"),
                    employee.get("last_name"),
                )
                if part
            )
            if employee
            else None
        ),
        employee_code=employee.get("employee_id") if employee else None,
        department_name=(
            employee.get("department_name") if employee else None
        ),
        review_comment=regularization.get("review_comment"),
    )


@router.post(
    "/employee-attendance/regularization",
    response_model=APIResponse[
        AttendanceRegularizationResponse
    ],
)
async def create_regularization_request(
    data: AttendanceRegularizationCreate,
    current_user: dict = Depends(get_current_user),
    _permission: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_CREATE)
    ),
):
    employee = await employee_repository.get_by_email(
        current_user["email"]
    )

    if not employee:
        raise AppException(
            "No employee record found for this account",
            404,
        )

    regularization = await service.create_request(
        employee_id=employee["employee_id"],
        attendance_id=data.attendance_id,
        attendance_date=data.date,
        issue_type=data.issue_type,
        requested_check_in=data.requested_check_in,
        requested_check_out=data.requested_check_out,
        reason=data.reason,
    )

    await invalidate_attendance_regularization_cache()

    return APIResponse(
        success=True,
        message="Regularization request submitted successfully",
        data=await serialize_regularization(regularization),
    )


@router.get(
    "/employees/{employee_id}/attendance/regularization",
    response_model=APIResponse[
        list[AttendanceRegularizationResponse]
    ],
)
async def get_employee_regularization_requests(
    employee_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 100
    cache_key = f"attendance:regularization:emp:{employee_id}:{page_val}:{limit_val}"
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Regularization requests retrieved successfully",
                data=[
                    AttendanceRegularizationResponse(**item)
                    for item in cached
                ],
            )
        except Exception:
            pass

    skip = (page_val - 1) * limit_val

    requests = await service.get_employee_requests(
        employee_id=employee_id,
        skip=skip,
        limit=limit_val,
    )

    serialized = [
        await serialize_regularization(request)
        for request in requests
    ]
    await set_cache(
        cache_key,
        [item.model_dump(mode="json") for item in serialized],
        ttl=REGULARIZATION_LIST_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Regularization requests retrieved successfully",
        data=serialized,
    )


@router.get(
    "/employee-attendance/regularization/{regularization_id}",
    response_model=APIResponse[
        AttendanceRegularizationResponse
    ],
)
async def get_regularization_request(
    regularization_id: str,
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    cache_key = f"attendance:regularization:detail:{regularization_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Regularization request retrieved successfully",
                data=AttendanceRegularizationResponse(**cached),
            )
        except Exception:
            pass

    regularization = await service.get_request(
        regularization_id
    )

    serialized = await serialize_regularization(regularization)
    await set_cache(cache_key, serialized.model_dump(mode="json"), ttl=REGULARIZATION_DETAIL_CACHE_TTL)

    return APIResponse(
        success=True,
        message="Regularization request retrieved successfully",
        data=serialized,
    )


@router.get(
    "/employee-attendance/regularization",
    response_model=APIResponse[list[AttendanceRegularizationResponse]],
)
async def get_regularization_requests(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.ATTENDANCE_APPROVE)),
):
    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 100
    status_val = status if isinstance(status, str) else None
    status_key = status_val or "all"
    cache_key = f"attendance:regularization:list:{status_key}:{page_val}:{limit_val}"
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Regularization requests retrieved successfully",
                data=[AttendanceRegularizationResponse(**item) for item in cached],
            )
        except Exception:
            pass

    requests = await service.get_all_requests(
        status=status_val,
        skip=(page_val - 1) * limit_val,
        limit=limit_val,
    )

    serialized = [await serialize_regularization(request) for request in requests]
    await set_cache(
        cache_key,
        [item.model_dump(mode="json") for item in serialized],
        ttl=REGULARIZATION_LIST_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Regularization requests retrieved successfully",
        data=serialized,
    )


@router.patch(
    "/employee-attendance/regularization/{regularization_id}/review",
    response_model=APIResponse[AttendanceRegularizationResponse],
)
async def review_regularization_request(
    regularization_id: str,
    data: AttendanceRegularizationReview,
    current_user: dict = Depends(require_permission(Permission.ATTENDANCE_APPROVE)),
):
    regularization = await service.review_request(
        regularization_id=regularization_id,
        decision=data.status,
        reviewed_by=str(current_user["_id"]),
        comment=data.comment,
    )

    await invalidate_attendance_regularization_cache()
    await invalidate_attendance_cache()

    return APIResponse(
        success=True,
        message="Regularization request reviewed successfully",
        data=await serialize_regularization(regularization),
    )

