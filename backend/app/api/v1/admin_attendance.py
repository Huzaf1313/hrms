from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import (
    get_current_user,
    require_hr_admin,
    require_permission,
)
from app.core.exceptions import AppException
from app.core.roles import Permission, UserRole
from app.core.cache import (
    get_cache,
    set_cache,
    invalidate_attendance_cache,
    invalidate_attendance_options_cache,
)

ATTENDANCE_OPTIONS_CACHE_TTL = 1800
ATTENDANCE_HISTORICAL_CACHE_TTL = 300
ATTENDANCE_TODAY_CACHE_TTL = 30
ATTENDANCE_RECORD_CACHE_TTL = 300

from app.repositories.employee_repository import EmployeeRepository
from app.schemas.attendance import (
    AttendanceListResponse,
    AttendanceMark,
    AttendanceOptionsResponse,
    AttendanceResponse,
    AttendanceSummaryResponse,
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

    await invalidate_attendance_cache()

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

    await invalidate_attendance_cache()

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
    current_user: dict = Depends(require_permission(Permission.ATTENDANCE_CREATE)),
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
    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 10
    search_val = search if isinstance(search, str) else None
    search_str = search_val.strip().lower() if search_val else "none"
    dept_val = department_id if isinstance(department_id, str) else None
    status_val = status if isinstance(status, str) else None
    shift_val = shift_id if isinstance(shift_id, str) else None
    ot_val = overtime if isinstance(overtime, bool) else False
    loc_val = work_location if isinstance(work_location, str) else None
    date_val = attendance_date if isinstance(attendance_date, date) else None

    today = business_today()
    is_historical = date_val is not None and date_val < today
    ttl = ATTENDANCE_HISTORICAL_CACHE_TTL if is_historical else ATTENDANCE_TODAY_CACHE_TTL

    role = getattr(current_user.get("role"), "value", current_user.get("role")) if current_user else None
    scope = f"mgr_{current_user.get('_id')}" if role == UserRole.MANAGER.value else "hr"

    date_str = str(date_val) if date_val else "today"
    cache_key = (
        f"attendance:list:{scope}:{date_str}:{dept_val or 'all'}:{status_val or 'all'}:"
        f"{shift_val or 'all'}:{loc_val or 'all'}:{ot_val}:{search_str}:{page_val}:{limit_val}"
    )

    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Attendance records retrieved successfully",
                data=AttendanceListResponse(**cached),
            )
        except Exception:
            pass

    pagination = PaginationParams(page=page_val, limit=limit_val)

    result = await service.get_attendance_list(
        attendance_date=date_val,
        department_id=dept_val,
        status=status_val,
        search=search_val,
        pagination=pagination,
        shift_id=shift_val,
        overtime_only=ot_val,
        work_location=loc_val,
        current_user=current_user,
    )

    await set_cache(cache_key, result.model_dump(), ttl=ttl)

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
    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 100
    result = await service.get_employee_attendance(
        employee_id=employee_id,
        pagination=PaginationParams(page=page_val, limit=limit_val),
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
    role = getattr(current_user.get("role"), "value", current_user.get("role"))
    if role == UserRole.MANAGER.value:
        user_id = str(current_user.get("_id", ""))
        scope = f"mgr_{user_id}"
    else:
        scope = "hr"

    cache_key = f"attendance:options:{scope}"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_model = AttendanceOptionsResponse(**cached_data)
            return APIResponse(
                success=True,
                message="Attendance filter options retrieved successfully",
                data=cached_model,
            )
        except Exception:
            pass

    work_locations = await service.get_work_locations(
        current_user=current_user,
    )
    response_data = AttendanceOptionsResponse(work_locations=work_locations)

    await set_cache(
        cache_key,
        response_data.model_dump(),
        ttl=ATTENDANCE_OPTIONS_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Attendance filter options retrieved successfully",
        data=response_data,
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
    dept_val = department_id if isinstance(department_id, str) else None
    today = business_today()
    is_historical = attendance_date < today
    ttl = ATTENDANCE_HISTORICAL_CACHE_TTL if is_historical else ATTENDANCE_TODAY_CACHE_TTL
    dept_str = dept_val or "all"

    role = getattr(current_user.get("role"), "value", current_user.get("role")) if current_user else None
    scope = f"mgr_{current_user.get('_id')}" if role == UserRole.MANAGER.value else "hr"
    cache_key = f"attendance:summary:{scope}:{attendance_date}:{dept_str}"

    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Attendance summary retrieved successfully",
                data=AttendanceSummaryResponse(**cached),
            )
        except Exception:
            pass

    summary = await service.get_summary(
        attendance_date=attendance_date,
        department_id=dept_val,
        current_user=current_user,
    )

    await set_cache(cache_key, summary.model_dump(), ttl=ttl)

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
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    cache_key = f"attendance:record:{attendance_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Attendance record retrieved successfully",
                data=AttendanceResponse(**cached),
            )
        except Exception:
            pass

    attendance = await service.get_attendance(
        attendance_id,
        current_user=current_user,
    )

    await set_cache(cache_key, attendance.model_dump(), ttl=ATTENDANCE_RECORD_CACHE_TTL)

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

    await invalidate_attendance_cache(attendance_id)

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

    await invalidate_attendance_cache(attendance_id)

    return APIResponse(
        success=True,
        message="Attendance record approved successfully",
        data=attendance,
    )
