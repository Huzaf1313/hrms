from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_permission
from app.core.roles import Permission
from app.schemas.common import APIResponse
from app.schemas.employee_attendance import (
    AttendanceCreate,
    AttendanceResponse,
    AttendanceUpdate,
)
from app.services.employee_attendance_service import (
    EmployeeAttendanceService,
)


router = APIRouter()

service = EmployeeAttendanceService()

def serialize_attendance(
    attendance: dict,
) -> AttendanceResponse:
    attendance_date = attendance["date"]
    if hasattr(attendance_date, "date"):
        attendance_date = attendance_date.date()

    return AttendanceResponse(
        id=str(attendance["_id"]),
        employee_id=attendance["employee_id"],
        date=attendance_date,
        check_in=attendance.get("check_in") or attendance.get("in_time"),
        check_out=attendance.get("check_out") or attendance.get("out_time"),
        status=attendance.get("status", "present"),
        total_hours=attendance.get("total_hours") or attendance.get("working_hours"),
        remarks=attendance.get("remarks") or attendance.get("notes"),
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
    attendance_data = data.model_dump()

    attendance = await service.create_attendance(
        attendance_data
    )

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
    skip = (page - 1) * limit

    attendance = await service.get_attendance_by_date_range(
        start_date=start_date,
        end_date=end_date,
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
    attendance = await service.get_attendance(
        attendance_id
    )

    return APIResponse(
        success=True,
        message="Attendance retrieved successfully",
        data=serialize_attendance(attendance),
    )


@router.get(
    "/employee-attendance/employees/{employee_id}",
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
    skip = (page - 1) * limit

    attendance = await service.get_employee_attendance(
        employee_id=employee_id,
        skip=skip,
        limit=limit,
    )

    return APIResponse(
        success=True,
        message="Employee attendance retrieved successfully",
        data=[
            serialize_attendance(record)
            for record in attendance
        ],
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
    current_user: dict | None = Depends(
        require_permission(Permission.ATTENDANCE_UPDATE)
    ),
):
    update_data = data.model_dump()

    attendance = await service.update_attendance(
        attendance_id=attendance_id,
        update_data=update_data,
    )

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

    return APIResponse(
        success=True,
        message="Attendance deleted successfully",
        data=None,
    )
