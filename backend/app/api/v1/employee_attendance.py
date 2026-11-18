from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_permission
from app.core.cache import (
    get_cache,
    invalidate_attendance_cache,
    set_cache,
)
from app.core.exceptions import AppException
from app.core.roles import Permission, UserRole, has_permission
from app.core.scope import scope_matches, visibility_scope
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.common import APIResponse
from app.schemas.employee_attendance import (
    AttendanceCreate,
    AttendanceResponse,
    AttendanceUpdate,
)
from app.services.attendance_calculation import (
    format_minutes_compact,
    resolve_record_metrics,
)
from app.services.attendance_service import business_today, record_shift_duration
from app.services.employee_attendance_service import (
    EmployeeAttendanceService,
)

ATTENDANCE_HISTORICAL_CACHE_TTL = 300
ATTENDANCE_TODAY_CACHE_TTL = 30
ATTENDANCE_RECORD_CACHE_TTL = 300

router = APIRouter()

service = EmployeeAttendanceService()
employee_repository = EmployeeRepository()


def serialize_attendance(
    attendance: dict,
) -> AttendanceResponse:
    attendance_date = attendance["date"]

    if hasattr(attendance_date, "date"):
        attendance_date = attendance_date.date()

    check_in = attendance.get("check_in") or attendance.get("in_time")
    check_out = attendance.get("check_out") or attendance.get("out_time")

    # Recomputed on read for the same reason as the admin list: the stored
    # overtime is a snapshot from when the record was written, so an employee
    # whose times were later corrected would otherwise keep seeing zero.
    metrics = resolve_record_metrics(attendance)

    return AttendanceResponse(
        id=str(attendance["_id"]),
        employee_id=attendance["employee_id"],
        date=attendance_date,
        check_in=check_in,
        check_out=check_out,
        status=attendance.get("status", "present"),
        total_hours=attendance.get("total_hours")
        or attendance.get("working_hours"),
        remarks=attendance.get("remarks") or attendance.get("notes"),
        shift_id=attendance.get("shift_id"),
        shift=attendance.get("shift") or "General",
        shift_start=attendance.get("shift_start"),
        shift_end=attendance.get("shift_end"),
        shift_duration_minutes=record_shift_duration(attendance),
        worked_minutes=metrics.worked_minutes,
        overtime_minutes=metrics.overtime_minutes,
        overtime_display=format_minutes_compact(metrics.overtime_minutes),
        late_minutes=metrics.late_minutes,
        late_display=format_minutes_compact(metrics.late_minutes),
        is_overtime=metrics.overtime_minutes > 0,
        is_late=metrics.late_minutes > 0,
        is_overnight=metrics.is_overnight,
        created_at=attendance.get("created_at"),
        updated_at=attendance.get("updated_at"),
    )


@router.post(
    "/employee-attendance",
    response_model=APIResponse[AttendanceResponse],
)
async def create_attendance(
    data: AttendanceCreate,
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_CREATE)
    ),
):
    role = getattr(current_user.get("role"), "value", current_user.get("role")) if current_user else None
    if role == "employee":
        current_emp_id = current_user.get("employee_id")
        if not current_emp_id or current_emp_id != data.employee_id:
            raise AppException("You can only check in for your own account", 403)

    attendance_data = data.model_dump()

    attendance = await service.create_attendance(
        attendance_data
    )

    await invalidate_attendance_cache()

    return APIResponse(
        success=True,
        message="Attendance created successfully",
        data=serialize_attendance(attendance),
    )


@router.get(
    "/employee-attendance/range",
    response_model=APIResponse[list[AttendanceResponse]],
)
async def get_attendance_by_date_range(
    start_date: date = Query(...),
    end_date: date = Query(...),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    today = business_today()
    is_historical = end_date < today
    ttl = ATTENDANCE_HISTORICAL_CACHE_TTL if is_historical else ATTENDANCE_TODAY_CACHE_TTL
    cache_key = f"attendance:range:{start_date}:{end_date}:{page}:{limit}"

    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Attendance retrieved successfully",
                data=[AttendanceResponse(**item) for item in cached],
            )
        except Exception:
            pass

    skip = (page - 1) * limit

    attendance = await service.get_attendance_by_date_range(
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )

    serialized = [serialize_attendance(record) for record in attendance]
    await set_cache(cache_key, [item.model_dump(mode="json") for item in serialized], ttl=ttl)

    return APIResponse(
        success=True,
        message="Attendance retrieved successfully",
        data=serialized,
    )


@router.get(
    "/employee-attendance/{attendance_id}",
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
                message="Attendance retrieved successfully",
                data=AttendanceResponse(**cached),
            )
        except Exception:
            pass

    attendance = await service.get_attendance(
        attendance_id
    )

    serialized = serialize_attendance(attendance)
    await set_cache(cache_key, serialized.model_dump(mode="json"), ttl=ATTENDANCE_RECORD_CACHE_TTL)

    return APIResponse(
        success=True,
        message="Attendance retrieved successfully",
        data=serialized,
    )


@router.get(
    "/employee-attendance/employees/{employee_id}",
    response_model=APIResponse[list[AttendanceResponse]],
)
async def get_employee_attendance(
    employee_id: str,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    start_date: date | None = Query(
        default=None,
        description="Inclusive lower bound, for paging the calendar by month",
    ),
    end_date: date | None = Query(
        default=None,
        description="Inclusive upper bound, for paging the calendar by month",
    ),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    if not current_user:
        raise AppException("Unauthorized", 401)

    role = getattr(current_user.get("role"), "value", current_user.get("role"))

    # Resolve target employee to verify existence and relationships
    target_emp = await employee_repository.get_by_employee_id(employee_id)
    if not target_emp:
        target_emp = await employee_repository.get_by_id(employee_id)
    if not target_emp:
        raise AppException("Employee not found", 404)

    # 1. Employees can access only their own attendance
    if role == UserRole.EMPLOYEE.value or role == "employee":
        caller_emp_id = current_user.get("employee_id")
        if not caller_emp_id and current_user.get("email"):
            caller_emp = await employee_repository.get_by_email(current_user["email"])
            if caller_emp:
                caller_emp_id = caller_emp.get("employee_id")

        target_code = target_emp.get("employee_id")
        target_doc_id = str(target_emp.get("_id") or "")
        caller_doc_id = str(current_user.get("_id") or "")

        is_self = False
        if caller_emp_id and target_code and caller_emp_id == target_code:
            is_self = True
        elif caller_doc_id and (target_doc_id == caller_doc_id or employee_id == caller_doc_id):
            is_self = True

        if not is_self:
            raise AppException(
                "You are not authorized to access this attendance information",
                403,
            )

    # 2. Managers can access only employees within their authorized reporting scope
    elif role == UserRole.MANAGER.value or role == "manager":
        scope = visibility_scope(current_user)
        if not scope_matches(target_emp, scope):
            raise AppException(
                "You are not authorized to access attendance for this employee",
                403,
            )

    # 3. HR/Admin access follows existing project permissions

    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 100
    skip = (page_val - 1) * limit_val

    if start_date and end_date and end_date < start_date:
        raise AppException(
            "End date cannot be before start date",
            400,
        )

    today = business_today()
    is_historical = end_date is not None and end_date < today
    ttl = ATTENDANCE_HISTORICAL_CACHE_TTL if is_historical else ATTENDANCE_TODAY_CACHE_TTL
    cache_key = f"attendance:emp:{employee_id}:{start_date or 'none'}:{end_date or 'none'}:{page_val}:{limit_val}"

    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Employee attendance retrieved successfully",
                data=[AttendanceResponse(**item) for item in cached],
            )
        except Exception:
            pass

    attendance = await service.get_employee_attendance(
        employee_id=employee_id,
        skip=skip,
        limit=limit_val,
        start_date=start_date,
        end_date=end_date,
    )

    serialized = [serialize_attendance(record) for record in attendance]
    await set_cache(
        cache_key,
        [item.model_dump(mode="json") for item in serialized],
        ttl=ttl,
    )

    return APIResponse(
        success=True,
        message="Employee attendance retrieved successfully",
        data=serialized,
    )


@router.get(
    "/employee-attendance",
    response_model=APIResponse[list[AttendanceResponse]],
)
async def get_attendance_by_date(
    attendance_date: date = Query(..., alias="date"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=100, ge=1, le=100),
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    skip = (page - 1) * limit

    attendance = await service.get_attendance_by_date(
        attendance_date=attendance_date,
        skip=skip,
        limit=limit,
    )

    return APIResponse(
        success=True,
        message="Attendance retrieved successfully",
        data=[
            serialize_attendance(record)
            for record in attendance
        ],
    )


@router.put(
    "/employee-attendance/{attendance_id}",
    response_model=APIResponse[AttendanceResponse],
)
async def update_attendance(
    attendance_id: str,
    data: AttendanceUpdate,
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")

    # HR Admin / Manager:
    # Require the normal attendance update permission.
    if role != "employee":
        if not has_permission(
            role,
            Permission.ATTENDANCE_UPDATE,
        ):
            raise AppException(
                "You do not have permission to perform this action",
                403,
            )

    # Get the attendance record before updating it.
    attendance = await service.get_attendance(
        attendance_id
    )

    # Employee:
    # Only allow the logged-in employee to update
    # their own attendance record.
    if role == "employee":
        current_employee_id = current_user.get("employee_id")

        if not current_employee_id:
            raise AppException(
                "Employee ID is missing from the current user",
                403,
            )

        if attendance.get("employee_id") != current_employee_id:
            raise AppException(
                "You can only update your own attendance",
                403,
            )

        update_data = data.model_dump(
            exclude_none=True
        )

        # Employees can only perform self-checkout.
        allowed_fields = {
            "check_out",
            "total_hours",
        }

        if not set(update_data).issubset(allowed_fields):
            raise AppException(
                "Employees can only update checkout details",
                403,
            )

    else:
        # HR Admin / Manager can use the full AttendanceUpdate schema.
        update_data = data.model_dump(
            exclude_none=True
        )

    attendance = await service.update_attendance(
        attendance_id=attendance_id,
        update_data=update_data,
    )

    await invalidate_attendance_cache(attendance_id)

    return APIResponse(
        success=True,
        message="Attendance updated successfully",
        data=serialize_attendance(attendance),
    )


@router.delete(
    "/employee-attendance/{attendance_id}",
    response_model=APIResponse[None],
)
async def delete_attendance(
    attendance_id: str,
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_UPDATE)
    ),
):
    await service.delete_attendance(
        attendance_id
    )

    await invalidate_attendance_cache(attendance_id)

    return APIResponse(
        success=True,
        message="Attendance deleted successfully",
        data=None,
    )