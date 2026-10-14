from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AppException
from app.core.jwt import decode_token
from app.core.roles import Permission, has_permission
from app.repositories.user_repository import UserRepository

security = HTTPBearer()

user_repository = UserRepository()


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