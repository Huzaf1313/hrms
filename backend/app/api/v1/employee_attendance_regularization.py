from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.employee_attendance_regularization import (
    AttendanceRegularizationCreate,
    AttendanceRegularizationResponse,
    AttendanceRegularizationReview,
)
from app.services.employee_attendance_regularization_service import (
    EmployeeAttendanceRegularizationService,
)
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository

router = APIRouter()

service = EmployeeAttendanceRegularizationService()
employee_repository = EmployeeRepository()

# Keep this consistent with the current employee API setup.
AUTH_ENABLED = False


def require_permission_toggle(permission: Permission):
    if AUTH_ENABLED:
        return require_permission(permission)

    async def bypass_auth() -> None:
        return None

    return bypass_auth


def serialize_regularization(
    regularization: dict,
    employee: dict | None = None,
    department: dict | None = None,
    attendance: dict | None = None,
) -> AttendanceRegularizationResponse:
    return AttendanceRegularizationResponse(
        id=str(regularization["_id"]),
        employee_id=regularization["employee_id"],
        attendance_id=regularization["attendance_id"],
        date=regularization["date"],
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
        employee_name=(
            f'{employee.get("first_name", "")} '
            f'{employee.get("last_name", "")}'
        ).strip() if employee else None,
        employee_code=employee.get("employee_id") if employee else None,
        department_name=department.get("name") if department else None,
        current_check_in=(
            attendance.get("check_in") or attendance.get("in_time")
            if attendance else None
        ),
        current_check_out=(
            attendance.get("check_out") or attendance.get("out_time")
            if attendance else None
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
        require_permission_toggle(
            Permission.ATTENDANCE_CREATE
        )
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
        require_permission_toggle(
            Permission.ATTENDANCE_READ
        )
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
        require_permission_toggle(
            Permission.ATTENDANCE_READ
        )
    ),
):
    regularization = await service.get_request(
        regularization_id
    )

    employee = await employee_repository.get_by_employee_id(
        regularization["employee_id"]
    )
    attendance = await service.attendance_repository.get_by_id(
        regularization["attendance_id"]
    )

    return APIResponse(
        success=True,
        message="Regularization request retrieved successfully",
        data=serialize_regularization(regularization, employee, attendance=attendance),
    )


@router.get(
    "/employee-attendance/regularization",
    response_model=APIResponse[list[AttendanceRegularizationResponse]],
)
async def get_regularization_requests(
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.ATTENDANCE_READ)),
):
    requests = await service.get_all_requests(
        status=status,
        skip=(page - 1) * limit,
        limit=limit,
    )
    serialized = []
    for request in requests:
        employee = await employee_repository.get_by_employee_id(
            request["employee_id"]
        )
        attendance = await service.attendance_repository.get_by_id(
            request["attendance_id"]
        )
        serialized.append(
            serialize_regularization(request, employee, attendance=attendance)
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
    review: AttendanceRegularizationReview,
    current_user: dict = Depends(require_permission(Permission.ATTENDANCE_APPROVE)),
):
    reviewed = await service.review_request(
        regularization_id=regularization_id,
        decision=review.status,
        reviewed_by=str(current_user["_id"]),
        comment=review.comment,
    )
    employee = await employee_repository.get_by_employee_id(
        reviewed["employee_id"]
    )
    attendance = await service.attendance_repository.get_by_id(
        reviewed["attendance_id"]
    )

    return APIResponse(
        success=True,
        message=f"Regularization request {reviewed['status'].lower()} successfully",
        data=serialize_regularization(reviewed, employee, attendance=attendance),
    )
