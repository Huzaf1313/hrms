from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user, require_permission
from app.core.exceptions import AppException
from app.core.roles import Permission
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.common import APIResponse
from app.schemas.shift import (
    ShiftAssign,
    ShiftAssignmentResponse,
    ShiftCreate,
    ShiftResponse,
    ShiftUpdate,
)
from app.services.attendance_service import AttendanceService
from app.services.shift_service import ShiftService


router = APIRouter()

service = ShiftService()
employee_repository = EmployeeRepository()
attendance_service = AttendanceService()


# Active shifts only. Available to employees so they can see the list, but the
# employee-scoped routes below never expose another employee's assignment.
@router.get(
    "/shifts",
    response_model=APIResponse[list[ShiftResponse]],
)
async def get_shifts(
    current_user: dict = Depends(require_permission(Permission.SHIFT_READ)),
):
    shifts = await service.get_all_shifts(include_inactive=False)

    return APIResponse(
        success=True,
        message="Shifts retrieved successfully",
        data=shifts,
    )


@router.get(
    "/shifts/me",
    response_model=APIResponse[ShiftResponse | None],
)
async def get_my_shift(
    current_user: dict = Depends(get_current_user),
):
    """The logged-in employee's own shift, so they can see their own hours."""
    employee = await employee_repository.get_by_email(current_user["email"])

    if not employee:
        raise AppException("No employee record found for this account", 404)

    shift = await service.get_employee_shift(employee["employee_id"])

    return APIResponse(
        success=True,
        message="Shift retrieved successfully",
        data=shift,
    )


@router.get(
    "/admin/shifts",
    response_model=APIResponse[list[ShiftResponse]],
)
async def get_all_shifts(
    include_inactive: bool = Query(default=True),
    current_user: dict = Depends(
        require_permission(Permission.SHIFT_UPDATE)
    ),
):
    shifts = await service.get_all_shifts(include_inactive=include_inactive)

    return APIResponse(
        success=True,
        message="Shifts retrieved successfully",
        data=shifts,
    )


@router.post(
    "/admin/shifts",
    response_model=APIResponse[ShiftResponse],
)
async def create_shift(
    data: ShiftCreate,
    current_user: dict = Depends(require_permission(Permission.SHIFT_CREATE)),
):
    shift = await service.create_shift(data.model_dump())

    return APIResponse(
        success=True,
        message="Shift created successfully",
        data=shift,
    )


@router.put(
    "/admin/shifts/{shift_id}",
    response_model=APIResponse[ShiftResponse],
)
async def update_shift(
    shift_id: str,
    data: ShiftUpdate,
    current_user: dict = Depends(require_permission(Permission.SHIFT_UPDATE)),
):
    shift = await service.update_shift(shift_id, data.model_dump())

    return APIResponse(
        success=True,
        message="Shift updated successfully",
        data=shift,
    )


@router.delete(
    "/admin/shifts/{shift_id}",
    response_model=APIResponse[None],
)
async def delete_shift(
    shift_id: str,
    current_user: dict = Depends(require_permission(Permission.SHIFT_DELETE)),
):
    await service.delete_shift(shift_id)

    return APIResponse(
        success=True,
        message="Shift deleted successfully",
        data=None,
    )


@router.put(
    "/admin/employees/{employee_id}/shift",
    response_model=APIResponse[ShiftAssignmentResponse],
)
async def assign_employee_shift(
    employee_id: str,
    data: ShiftAssign,
    current_user: dict = Depends(
        require_permission(Permission.EMPLOYEES_UPDATE)
    ),
):
    """Assigns a shift to one employee. Send a null shift_id to clear it."""
    await service.assign_to_employee(employee_id, data.shift_id)

    shift = await service.get_employee_shift(employee_id)

    return APIResponse(
        success=True,
        message="Shift assigned successfully",
        data=ShiftAssignmentResponse(
            employee_id=employee_id,
            shift_id=data.shift_id,
            shift=shift,
        ),
    )


@router.get(
    "/admin/employees/{employee_id}/shift",
    response_model=APIResponse[ShiftAssignmentResponse],
)
async def get_employee_shift(
    employee_id: str,
    current_user: dict = Depends(
        require_permission(Permission.EMPLOYEES_READ)
    ),
):
    shift = await service.get_employee_shift(employee_id)

    return APIResponse(
        success=True,
        message="Shift retrieved successfully",
        data=ShiftAssignmentResponse(
            employee_id=employee_id,
            shift_id=shift.id if shift else None,
            shift=shift,
        ),
    )


@router.get(
    "/admin/overtime",
    response_model=APIResponse[list[dict]],
)
async def get_overtime_report(
    start_date: date = Query(alias="start_date"),
    end_date: date = Query(alias="end_date"),
    department_id: str | None = Query(default=None),
    shift_id: str | None = Query(default=None),
    current_user: dict = Depends(
        require_permission(Permission.ATTENDANCE_READ)
    ),
):
    """Per-employee overtime totals for a date range. Hours only.

    Overtime is filed under the day the shift started, so a night shift that
    ends after midnight appears on its starting date.
    """
    if end_date < start_date:
        raise AppException(
            "End date cannot be before start date",
            400,
        )

    rows = await attendance_service.get_overtime_report(
        start_date=start_date,
        end_date=end_date,
        department_id=department_id,
        shift_id=shift_id,
    )

    return APIResponse(
        success=True,
        message="Overtime report retrieved successfully",
        data=rows,
    )
