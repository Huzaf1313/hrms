from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.employee_attendance_regularization import (
    AttendanceRegularizationCreate,
    AttendanceRegularizationResponse,
)
from app.services.employee_attendance_regularization_service import (
    EmployeeAttendanceRegularizationService,
)


router = APIRouter()

service = EmployeeAttendanceRegularizationService()

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
    )


@router.post(
    "/employee-attendance/regularization",
    response_model=APIResponse[
        AttendanceRegularizationResponse
    ],
)
async def create_regularization_request(
    data: AttendanceRegularizationCreate,
    employee_id: str = Query(...),
    current_user: dict | None = Depends(
        require_permission_toggle(
            Permission.ATTENDANCE_CREATE
        )
    ),
):
    regularization = await service.create_request(
        employee_id=employee_id,
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

    return APIResponse(
        success=True,
        message="Regularization request retrieved successfully",
        data=serialize_regularization(regularization),
    )