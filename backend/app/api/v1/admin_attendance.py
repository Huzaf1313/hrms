from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_hr_admin, require_permission
from app.core.exceptions import AppException
from app.core.roles import Permission
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.attendance import (
    AttendanceListResponse,
    AttendanceMark,
    AttendanceOptionsResponse,
    AttendanceResponse,
    AttendanceSummaryResponse,
    AttendanceTrendResponse,
    AttendanceUpdate,
    BulkAttendanceMark,
    BulkAttendanceResponse,
    MyAttendanceStatus,
)
from app.schemas.common import APIResponse
from app.services.attendance_service import AttendanceService, business_today
from app.utils.pagination import PaginationParams


router = APIRouter()

service = AttendanceService()
employee_repository = EmployeeRepository()

@router.post(
    "/attendance",
    response_model=APIResponse[AttendanceResponse],
)
async def mark_attendance(
    data: AttendanceMark,
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_CREATE)
    ),
):
    """Creates a new record for the employee+date, or updates the existing
    one and flags it as regularized if a record already exists."""
    marked_by = current_user.get("id") if current_user else None

    attendance = await service.mark_attendance(
        data.model_dump(),
        marked_by=str(current_user["_id"]) if current_user else None,
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Attendance marked successfully",
        data=attendance,
    )


@router.post(
    "/attendance/bulk",
    response_model=APIResponse[BulkAttendanceResponse],
)
async def bulk_mark_attendance(
    data: BulkAttendanceMark,
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_CREATE)
    ),
):
    """Bulk marks/updates attendance for selected employees or all matching
    filtered employees across pages. Applies the caller's employee-visibility
    scope and returns per-employee results."""
    marked_by = str(current_user["_id"]) if current_user and "_id" in current_user else None

    result = await service.bulk_mark_attendance(
        data=data,
        marked_by=marked_by,
        current_user=current_user,
    )

    message = f"Marked attendance for {result.success_count} employee(s)"
    if result.failure_count > 0:
        message += f" ({result.failure_count} failed)"

    return APIResponse(
        success=True,
        message=message,
        data=result,
    )



@router.get(
    "/attendance/me",
    response_model=APIResponse[MyAttendanceStatus],
)
async def get_my_attendance_status(
    attendance_date: date | None = Query(default=None, alias="date"),
    current_user: dict = Depends(get_current_user),
):
    """Employee self-service - status/in-time/out-time for the logged-in
    user. Users and employees are matched by email (the email used to log
    in is the same email stored on the employee's record). This route is
    registered before /attendance/{attendance_id} so "me" is never matched
    as an attendance_id path param."""
    employee = await employee_repository.get_by_email(current_user["email"])

    if not employee:
        raise AppException("No employee record found for this account", 404)

    status = await service.get_my_status(
        employee_id=employee["employee_id"],
        attendance_date=attendance_date or business_today(),
    )

    return APIResponse(
        success=True,
        message="Attendance status retrieved successfully",
        data=status,
    )


@router.post(
    "/attendance/me/punch",
    response_model=APIResponse[MyAttendanceStatus],
)
async def punch_my_attendance(
    current_user: dict = Depends(require_hr_admin),
):
    """HR self-punch: marks the signed-in user's OWN attendance for today
    with the server clock. First call of the day records the in-time, the
    second records the out-time, later calls return 409. The employee is
    resolved from the session's email - bootstrap HR accounts get their
    employee identity minted here on first punch (see employee_identity) -
    so no other employee can be marked through this route. Declared before
    /attendance/{attendance_id} so "me" is never matched as an
    attendance_id path param."""
    status = await service.punch_self(current_user=current_user)

    return APIResponse(
        success=True,
        message="Attendance punched successfully",
        data=status,
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
    shift_id: str | None = Query(default=None),
    overtime: bool = Query(default=False),
    work_location: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    pagination = PaginationParams(page=page, limit=limit)

    result = await service.get_attendance_list(
        attendance_date=attendance_date,
        department_id=department_id,
        status=status,
        search=search,
        pagination=pagination,
        shift_id=shift_id,
        overtime_only=overtime,
        work_location=work_location,
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Attendance records retrieved successfully",
        data=result,
    )



@router.get(
    "/employees/{employee_id}/attendance",
    response_model=APIResponse[list[AttendanceResponse]],
)
async def get_employee_attendance(
    employee_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    result = await service.get_employee_attendance(
        employee_id=employee_id,
        pagination=PaginationParams(page=page, limit=limit),
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Employee attendance retrieved successfully",
        data=result,
    )


@router.get(
    "/attendance/options",
    response_model=APIResponse[AttendanceOptionsResponse],
)
async def get_attendance_options(
    current_user: dict = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    """Values for the filter dropdowns. Declared before
    /attendance/{attendance_id} so "options" is never parsed as an id."""
    work_locations = await service.get_work_locations(
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Attendance filter options retrieved successfully",
        data=AttendanceOptionsResponse(work_locations=work_locations),
    )


@router.get(
    "/attendance/summary",
    response_model=APIResponse[AttendanceSummaryResponse],
)
async def get_attendance_summary(
    attendance_date: date = Query(alias="date"),
    department_id: str | None = Query(default=None),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
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
    "/attendance/trend",
    response_model=APIResponse[AttendanceTrendResponse],
)
async def get_attendance_trend(
    start_date: date = Query(...),
    end_date: date = Query(...),
    department_id: str | None = Query(default=None),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    """Daily attendance counts across a date range.

    Declared before /attendance/{attendance_id} so "trend" is never parsed as
    an attendance id.
    """
    trend = await service.get_trend(
        start_date=start_date,
        end_date=end_date,
        department_id=department_id,
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Attendance trend retrieved successfully",
        data=trend,
    )


@router.get(
    "/attendance/{attendance_id}",
    response_model=APIResponse[AttendanceResponse],
)
async def get_attendance(
    attendance_id: str,
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    attendance = await service.get_attendance(
        attendance_id,
        current_user=current_user
    )

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
        require_permission(Permission.ATTENDANCE_UPDATE)
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
        require_permission(Permission.ATTENDANCE_APPROVE)
    ),
):
    attendance = await service.update_attendance(
        attendance_id=attendance_id,
        update_data={},
        current_user=current_user,
    )

    return APIResponse(
        success=True,
        message="Attendance record approved successfully",
        data=attendance,
    )
