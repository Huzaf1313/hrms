from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import require_permission
from app.core.cache import (
    get_cache,
    invalidate_attendance_cache,
    invalidate_leaves_cache,
    set_cache,
)
from app.core.roles import Permission, UserRole
from app.schemas.admin_leave import (
    LeaveBalanceUpdate,
    LeaveCreate,
    LeaveStatusUpdate,
)
from app.services.admin_leave_service import AdminLeaveService

LEAVE_SUMMARY_CACHE_TTL = 120
LEAVE_LIST_CACHE_TTL = 120
LEAVE_DETAIL_CACHE_TTL = 300

router = APIRouter(
    prefix="/admin/leaves",
)

service = AdminLeaveService()


def _leave_scope(current_user: dict | None) -> str:
    if not current_user:
        return "hr"
    role = getattr(current_user.get("role"), "value", current_user.get("role"))
    if role == UserRole.MANAGER.value:
        return f"mgr_{current_user.get('_id')}"
    return "hr"


@router.get("/summary")
async def get_leave_summary(
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_READ)
    ),
):
    scope = _leave_scope(current_user)
    cache_key = f"leave:summary:{scope}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Leave summary fetched successfully",
            "data": cached,
        }

    summary = await service.get_summary(current_user=current_user)
    await set_cache(cache_key, summary, ttl=LEAVE_SUMMARY_CACHE_TTL)

    return {
        "success": True,
        "message": "Leave summary fetched successfully",
        "data": summary,
    }


@router.get("")
async def get_leaves(
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_READ)
    ),
    page: int = Query(
        default=1,
        ge=1,
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=100,
    ),
    status: str | None = None,
    employee_id: str | None = None,
    leave_type: str | None = None,
    department_id: str | None = None,
    leave_date: date | None = Query(
        default=None,
        alias="date",
        description=(
            "Only leaves covering this day. Matches when the day falls "
            "anywhere inside the request's start and end dates."
        ),
    ),
):
    scope = _leave_scope(current_user)
    date_str = str(leave_date) if leave_date else "all"
    cache_key = (
        f"leave:list:{scope}:{status or 'all'}:{employee_id or 'all'}:"
        f"{leave_type or 'all'}:{department_id or 'all'}:{date_str}:{page}:{limit}"
    )

    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Leave requests fetched successfully",
            "data": cached,
        }

    data = await service.get_leaves(
        page=page,
        limit=limit,
        status=status,
        employee_id=employee_id,
        leave_type=leave_type,
        department_id=department_id,
        leave_date=leave_date,
        current_user=current_user,
    )

    await set_cache(cache_key, data, ttl=LEAVE_LIST_CACHE_TTL)

    return {
        "success": True,
        "message": "Leave requests fetched successfully",
        "data": data,
    }


@router.get("/balances")
async def get_leave_balances(
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_READ)
    ),
):
    return {
        "success": True,
        "message": "Leave balances fetched successfully",
        "data": await service.get_balances(),
    }


@router.put("/balances")
async def update_leave_balances(
    payload: LeaveBalanceUpdate,
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_UPDATE)
    ),
):
    data = await service.update_balances(
        [
            entry.model_dump()
            for entry in payload.balances
        ]
    )

    return {
        "success": True,
        "message": "Leave balances updated successfully",
        "data": data,
    }


@router.get("/{leave_id}")
async def get_leave(
    leave_id: str,
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_READ)
    ),
):
    scope = _leave_scope(current_user)
    cache_key = f"leave:detail:{scope}:{leave_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        return {
            "success": True,
            "message": "Leave request fetched successfully",
            "data": cached,
        }

    data = await service.get_leave(
        leave_id,
        current_user=current_user,
    )

    await set_cache(cache_key, data, ttl=LEAVE_DETAIL_CACHE_TTL)

    return {
        "success": True,
        "message": "Leave request fetched successfully",
        "data": data,
    }


@router.post("")
async def create_leave(
    payload: LeaveCreate,
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_CREATE)
    ),
):
    data = await service.create_leave(
        payload.model_dump(),
        current_user=current_user,
    )

    await invalidate_leaves_cache()

    return {
        "success": True,
        "message": "Leave request created successfully",
        "data": data,
    }


@router.patch("/{leave_id}/status")
async def update_leave_status(
    leave_id: str,
    payload: LeaveStatusUpdate,
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_APPROVE)
    ),
):
    data = await service.update_status(
        leave_id=leave_id,
        status=payload.status,
        admin_note=payload.admin_note,
        admin_user_id=str(current_user["_id"]) if current_user else None,
        current_user=current_user,
    )

    await invalidate_leaves_cache()

    if getattr(payload.status, "value", payload.status) == "approved":
        await invalidate_attendance_cache()

    return {
        "success": True,
        "message": "Leave status updated successfully",
        "data": data,
    }


@router.delete("/{leave_id}")
async def delete_leave(
    leave_id: str,
    current_user: dict | None = Depends(
        require_permission(Permission.LEAVE_UPDATE)
    ),
):
    await service.delete_leave(
        leave_id,
        current_user=current_user,
    )

    await invalidate_leaves_cache()

    return {
        "success": True,
        "message": "Leave request deleted successfully",
        "data": None,
    }
