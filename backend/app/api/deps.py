from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AppException
from app.core.jwt import decode_token
from app.core.roles import (
    HR_LEVEL_ROLES,
    Permission,
    UserRole,
    has_permission,
    role_value,
)
from app.repositories.user_repository import UserRepository
from app.repositories.session_repository import SessionRepository

security = HTTPBearer()

user_repository = UserRepository()
session_repository = SessionRepository()



async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    token = credentials.credentials

    try:
        payload = decode_token(token)
    except Exception:
        raise AppException(
            "Invalid or expired access token",
            401,
        )

    if payload.get("type") != "access":
        raise AppException(
            "Invalid access token",
            401,
        )

    user_id = payload.get("sub")

    if not user_id:
        raise AppException(
            "Invalid access token",
            401,
        )

    # Verify that the access token belongs to an active session.
    session_id = payload.get("session_id")

    if not session_id:
        raise AppException(
            "Invalid access token",
            401,
        )

    session = await session_repository.get_by_id(session_id)

    if not session or not session.get("is_active", False):
        raise AppException(
            "Session has been revoked or is invalid",
            401,
        )

    # Ensure the session belongs to the user in the access token.
    if str(session.get("user_id")) != user_id:
        raise AppException(
            "Invalid access token session",
            401,
        )

    user = await user_repository.get_by_id(user_id)

    if not user:
        raise AppException(
            "User not found",
            401,
        )

    if not user.get("is_active", False):
        raise AppException(
            "User account is inactive",
            403,
        )

    if user.get("is_locked", False):
        raise AppException(
            "User account is locked",
            403,
        )

    return user


def require_permission(permission: Permission):
    async def permission_checker(
        current_user: dict = Depends(get_current_user),
    ):
        role = current_user.get("role")

        if not role:
            raise AppException(
                "User role is missing",
                403,
            )

        if not has_permission(role, permission):
            raise AppException(
                "You do not have permission to perform this action",
                403,
            )

        return current_user

    return permission_checker


async def require_hr_admin(
    current_user: dict = Depends(get_current_user),
):
    """HR only (the super admin counts as HR). Managers are admins in
    roles.py but must not reach these endpoints - manager account creation
    and exit-request review."""
    role = role_value(current_user.get("role"))

    if role not in HR_LEVEL_ROLES:
        raise AppException(
            "Only HR can perform this action",
            403,
        )

    return current_user


async def require_super_admin(
    current_user: dict = Depends(get_current_user),
):
    """Super admin only - managing the HR and manager accounts themselves."""
    role = role_value(current_user.get("role"))

    if role != UserRole.SUPER_ADMIN.value:
        raise AppException(
            "Only the super admin can perform this action",
            403,
        )

    return current_user

async def require_employee_self_update(
    current_user: dict = Depends(get_current_user),
):
    role = current_user.get("role")

    if not role:
        raise AppException(
            "User role is missing",
            403,
        )

    # HR/Admin/Manager are handled by the normal permission system
    if role != "employee":
        return current_user

    if not current_user.get("employee_id"):
        raise AppException(
            "Employee profile not found",
            404,
        )

    return current_user