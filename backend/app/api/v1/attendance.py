from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.attendance import (
    AttendanceListResponse,
    AttendanceMark,
    AttendanceResponse,
    AttendanceSummaryResponse,
    AttendanceUpdate,
)
from app.schemas.common import APIResponse
from app.services.attendance_service import AttendanceService
from app.utils.pagination import PaginationParams


router = APIRouter()

service = AttendanceService()

# TODO: set back to True once the frontend login flow + role handling is
# fully wired up. Mirrors the same toggle in app/api/v1/employees.py.
AUTH_ENABLED = False


def require_permission_toggle(permission: Permission):
    if AUTH_ENABLED:
        return require_permission(permission)

    async def bypass_auth() -> None:
        return None

    return bypass_auth


@router.post(
    "/attendance",
    response_model=APIResponse[AttendanceResponse],
)
async def mark_attendance(
    data: AttendanceMark,
    current_user: dict | None = Depends(
        require_permission_toggle(Permission.ATTENDANCE_CREATE)
    ),
):
    """Creates a new record for the employee+date, or updates the existing
    one and flags it as regularized if a record already exists."""
    marked_by = current_user.get("id") if current_user else None

    attendance = await service.mark_attendance(
        data.model_dump(),
        marked_by=marked_by,
    )

    return APIResponse(
        success=True,
        message="Attendance marked successfully",
        data=attendance,
    )


@router.get(
    "/attendance",
    response_model=APIResponse[AttendanceListResponse],
)
async def get_attendance_list(
    attendance_date: date | None = Query(default=None, alias="date"),
    department_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict | None = Depends(
        require_permission_toggle(Permission.ATTENDANCE_READ)
    ),
):
    pagination = PaginationParams(page=page, limit=limit)

    result = await service.get_attendance_list(
        attendance_date=attendance_date,
        department_id=department_id,
        status=status,
        search=search,
        pagination=pagination,
    )

    return APIResponse(
        success=True,
        message="Attendance records retrieved successfully",
        data=result,
    )


@router.get(
    "/attendance/summary",
    response_model=APIResponse[AttendanceSummaryResponse],
)
async def get_attendance_summary(
    attendance_date: date = Query(alias="date"),
    department_id: str | None = Query(default=None),
    current_user: dict | None = Depends(
        require_permission_toggle(Permission.ATTENDANCE_READ)
    ),
):
    summary = await service.get_summary(
        attendance_date=attendance_date,
        department_id=department_id,
    )

    return APIResponse(
        success=True,
        message="Attendance summary retrieved successfully",
        data=summary,
    )


@router.get(
    "/attendance/{attendance_id}",
    response_model=APIResponse[AttendanceResponse],
)
async def get_attendance(
    attendance_id: str,
    current_user: dict | None = Depends(
        require_permission_toggle(Permission.ATTENDANCE_READ)
    ),
):
    attendance = await service.get_attendance(attendance_id)

    return APIResponse(
        success=True,
        message="Attendance record retrieved successfully",
        data=attendance,
    )


@router.put(
    "/attendance/{attendance_id}",
    response_model=APIResponse[AttendanceResponse],
)
async def update_attendance(
    attendance_id: str,
    data: AttendanceUpdate,
    current_user: dict | None = Depends(
        require_permission_toggle(Permission.ATTENDANCE_UPDATE)
    ),
):
    attendance = await service.update_attendance(
        attendance_id=attendance_id,
        update_data=data.model_dump(),
    )

    return APIResponse(
        success=True,
        message="Attendance record updated successfully",
        data=attendance,
    )


@router.patch(
    "/attendance/{attendance_id}/approve",
    response_model=APIResponse[AttendanceResponse],
)
async def approve_regularization(
    attendance_id: str,
    current_user: dict | None = Depends(
        require_permission_toggle(Permission.ATTENDANCE_APPROVE)
    ),
):
    attendance = await service.update_attendance(
        attendance_id=attendance_id,
        update_data={},
    )

    return APIResponse(
        success=True,
        message="Attendance record approved successfully",
        data=attendance,
    )