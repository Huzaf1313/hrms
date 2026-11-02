from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_current_user
from app.core.cache import (
    get_cache,
    invalidate_employee_leaves_cache,
    invalidate_leaves_cache,
    set_cache,
)
from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.schemas.employee_leave import EmployeeLeaveCreate
from app.services.employee_leave_service import EmployeeLeaveService

EMPLOYEE_LEAVE_CACHE_TTL = 120
EMPLOYEE_LEAVE_PENDING_TTL = 60
EMPLOYEE_LEAVE_DETAIL_TTL = 300

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

    await invalidate_employee_leaves_cache(employee["employee_id"])
    await invalidate_leaves_cache()

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
    leave_date: date | None = Query(
        default=None,
        alias="date",
        description=(
            "Only leaves covering this day. Matches when the day falls "
            "anywhere inside the request's start and end dates."
        ),
    ),
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

    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 100
    status_val = status if isinstance(status, str) else None
    date_str = str(leave_date) if isinstance(leave_date, date) else "all"
    cache_key = f"leave:emp:{employee_id}:requests:{status_val or 'all'}:{date_str}:{page_val}:{limit_val}"

    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Leave requests fetched successfully",
            "data": cached,
        }

    data = await service.get_employee_requests(
        employee_id=employee_id,
        page=page_val,
        limit=limit_val,
        status=status_val,
        leave_date=leave_date,
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_LEAVE_CACHE_TTL)

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

    cache_key = f"leave:emp:{employee_id}:upcoming"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Upcoming leaves fetched successfully",
            "data": cached,
        }

    data = await service.get_upcoming_leaves(
        employee_id=employee_id
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_LEAVE_CACHE_TTL)

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

    cache_key = f"leave:emp:{employee_id}:balance"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Leave balance fetched successfully",
            "data": cached,
        }

    data = await service.get_leave_balance(
        employee_id=employee_id
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_LEAVE_CACHE_TTL)

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

    cache_key = f"leave:emp:{employee_id}:pending"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Pending leave count fetched successfully",
            "data": {
                "pending_count": cached
            },
        }

    data = await service.get_pending_count(
        employee_id=employee_id
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_LEAVE_PENDING_TTL)

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

    cache_key = f"leave:emp:{employee['employee_id']}:detail:{leave_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Leave request fetched successfully",
            "data": cached,
        }

    data = await service.get_request(
        leave_id=leave_id,
        employee_id=employee["employee_id"],
    )

    await set_cache(cache_key, data, ttl=EMPLOYEE_LEAVE_DETAIL_TTL)

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

    await invalidate_employee_leaves_cache(employee["employee_id"])
    await invalidate_leaves_cache()

    return {
        "success": True,
        "message": "Leave request cancelled successfully",
        "data": data,
    }