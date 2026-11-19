from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.cookies import ACCESS_COOKIE, CSRF_HEADER
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

# auto_error=False: the browser sends the token as a cookie instead of a
# header. The scheme is still declared so Swagger offers its Authorize box.
security = HTTPBearer(auto_error=False)

user_repository = UserRepository()
session_repository = SessionRepository()

# Methods that must not change state, so they are exempt from the CSRF
# header check in access_credentials.
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def access_credentials(
    request: Request,
    bearer: HTTPAuthorizationCredentials | None = Depends(security),
) -> HTTPAuthorizationCredentials:
    """The access token from the Authorization header (API clients) or the
    HttpOnly access cookie (the web app)."""
    # The header wins over the cookie. It needs no CSRF check: a browser never
    # attaches an Authorization header to a cross-site request on its own.
    if bearer and bearer.credentials:
        return bearer

    token = request.cookies.get(ACCESS_COOKIE)

    if not token:
        raise AppException("Not authenticated", 401)

    # Browsers attach cookies to cross-site requests too. Requiring a custom
    # header on writes stops a forged form or link from acting as the user.
    if request.method not in SAFE_METHODS and not request.headers.get(CSRF_HEADER):
        raise AppException("Missing CSRF header", 403)

    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(access_credentials),
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

    user["current_session_id"] = session_id

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

    # An exact match, not HR_LEVEL_ROLES: HR must not manage its own peers.
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
