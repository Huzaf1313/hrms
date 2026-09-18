from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.employee_attendance_regularization import (
    AttendanceRegularizationCreate,
    AttendanceRegularizationReview,
    AttendanceRegularizationResponse,
)
from app.services.employee_attendance_regularization_service import (
    EmployeeAttendanceRegularizationService,
)
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository

router = APIRouter()

service = EmployeeAttendanceRegularizationService()
employee_repository = EmployeeRepository()

def serialize_regularization(
    regularization: dict,
) -> AttendanceRegularizationResponse:
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

    return APIResponse(
        success=True,
        message="Regularization request submitted successfully",
        data=serialize_regularization(regularization),
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
    skip = (page - 1) * limit

    requests = await service.get_employee_requests(
        employee_id=employee_id,
        skip=skip,
        limit=limit,
    )

    return APIResponse(
        success=True,
        message="Regularization requests retrieved successfully",
        data=[
            serialize_regularization(request)
            for request in requests
        ],
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
    regularization = await service.get_request(
        regularization_id
    )

    return APIResponse(
        success=True,
        message="Regularization request retrieved successfully",
        data=serialize_regularization(regularization),
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
    requests = await service.get_all_requests(
        status=status,
        skip=(page - 1) * limit,
        limit=limit,
    )

    return APIResponse(
        success=True,
        message="Regularization requests retrieved successfully",
        data=[serialize_regularization(request) for request in requests],
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

    return APIResponse(
        success=True,
        message="Regularization request reviewed successfully",
        data=serialize_regularization(regularization),
    )
