from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.employee_leave import EmployeeLeaveCreate
from app.services.employee_leave_service import EmployeeLeaveService


router = APIRouter(
    prefix="/employee-leave",
    tags=["Employee Leave"],
)

service = EmployeeLeaveService()
employee_repository = EmployeeRepository()


async def get_employee_from_user(
    current_user: dict,
):
    email = current_user.get("email")

    if not email:
        raise AppException(
            "User email not found",
            401,
        )

    employee = await employee_repository.get_by_email(
        email
    )

    if not employee:
        raise AppException(
            "Employee not found",
            404,
        )

    return employee


def serialize_employee_leave(
    document: dict,
):
    if not document:
        return None

    return service._serialize(document)


@router.post("")
async def create_leave_request(
    payload: EmployeeLeaveCreate,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    data = await service.create_request(
        employee_id=employee["employee_id"],
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        attachment_url=payload.attachment_url,
    )

    return {
        "success": True,
        "message": "Leave request submitted successfully",
        "data": serialize_employee_leave(data),
    }


@router.get("/employees/{employee_id}")
async def get_employee_leave_requests(
    employee_id: str,
    page: int = Query(
        default=1,
        ge=1,
    ),
    limit: int = Query(
        default=100,
        ge=1,
        le=100,
    ),
    status: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    if employee["employee_id"] != employee_id:
        raise AppException(
            "You are not authorized to access these leave requests",
            403,
        )

    data = await service.get_employee_requests(
        employee_id=employee_id,
        page=page,
        limit=limit,
        status=status,
    )

    return {
        "success": True,
        "message": "Leave requests fetched successfully",
        "data": data,
    }


@router.get("/employees/{employee_id}/upcoming")
async def get_upcoming_leaves(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    if employee["employee_id"] != employee_id:
        raise AppException(
            "You are not authorized to access these leave requests",
            403,
        )

    data = await service.get_upcoming_leaves(
        employee_id=employee_id
    )

    return {
        "success": True,
        "message": "Upcoming leaves fetched successfully",
        "data": data,
    }


@router.get("/employees/{employee_id}/balance")
async def get_leave_balance(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    if employee["employee_id"] != employee_id:
        raise AppException(
            "You are not authorized to access this leave balance",
            403,
        )

    data = await service.get_leave_balance(
        employee_id=employee_id
    )

    return {
        "success": True,
        "message": "Leave balance fetched successfully",
        "data": data,
    }


@router.get("/employees/{employee_id}/pending-count")
async def get_pending_leave_count(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    if employee["employee_id"] != employee_id:
        raise AppException(
            "You are not authorized to access this leave information",
            403,
        )

    data = await service.get_pending_count(
        employee_id=employee_id
    )

    return {
        "success": True,
        "message": "Pending leave count fetched successfully",
        "data": {
            "pending_count": data
        },
    }


@router.get("/{leave_id}")
async def get_leave_request(
    leave_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    data = await service.get_request(
        leave_id=leave_id,
        employee_id=employee["employee_id"],
    )

    return {
        "success": True,
        "message": "Leave request fetched successfully",
        "data": data,
    }


@router.patch("/{leave_id}/cancel")
async def cancel_leave_request(
    leave_id: str,
    current_user: dict = Depends(get_current_user),
):
    employee = await get_employee_from_user(
        current_user
    )

    data = await service.cancel_request(
        leave_id=leave_id,
        employee_id=employee["employee_id"],
    )

    return {
        "success": True,
        "message": "Leave request cancelled successfully",
        "data": data,
    }