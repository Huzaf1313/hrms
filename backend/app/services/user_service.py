from datetime import datetime

from app.core.exceptions import AppException
from app.core.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.roles import UserRole
from app.core.security import hash_password, verify_password
from app.repositories.user_repository import UserRepository
from app.services.session_service import SessionService


class UserService:
    def __init__(self):
        self.repository = UserRepository()
        self.session_service = SessionService()

    async def register_user(
        self,
        full_name: str,
        email: str,
        password: str,
    ):
        email = email.lower().strip()

        existing_user = await self.repository.get_by_email(email)

        if existing_user:
            raise AppException(
                "User with this email already exists",
                409,
            )

        now = datetime.utcnow()

        user_data = {
            "full_name": full_name.strip(),
            "email": email,
            "password_hash": hash_password(password),
            "role": UserRole.EMPLOYEE.value,
            "is_active": True,
            "is_locked": False,
            "failed_login_attempts": 0,
            "created_at": now,
            "updated_at": now,
        }

        user = await self.repository.create(user_data)

        return user

    async def login_user(
        self,
        email: str,
        password: str,
    ):
        email = email.lower().strip()

        user = await self.repository.get_by_email(email)

        if not user:
            raise AppException(
                "Invalid email or password",
                401,
            )

        if user.get("is_locked"):
            raise AppException(
                "Account is locked",
                403,
            )

        if not user.get("is_active"):
            raise AppException(
                "Account is inactive",
                403,
            )

        password_valid = verify_password(
            password,
            user["password_hash"],
        )

        if not password_valid:
            raise AppException(
                "Invalid email or password",
                401,
            )

        user_id = str(user["_id"])
        role = user["role"]

        access_token = create_access_token(
            subject=user_id,
            role=role,
        )

        refresh_token = create_refresh_token(
            subject=user_id,
        )

        await self.session_service.create_session(
            user_id=user_id,
            refresh_token=refresh_token,
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }
    
    async def refresh_access_token(
        self,
        refresh_token: str,
    ):
        try:
            payload = decode_token(refresh_token)
        except Exception:
            raise AppException(
                "Invalid or expired refresh token",
                401,
            )

        if payload.get("type") != "refresh":
            raise AppException(
                "Invalid refresh token",
                401,
            )

        user_id = payload.get("sub")

        if not user_id:
            raise AppException(
                "Invalid refresh token",
                401,
            )

        session = await self.session_service.get_session_by_refresh_token(
            refresh_token
        )

        if not session:
            raise AppException(
                "Session not found",
                401,
            )

        if not session.get("is_active", False):
            raise AppException(
                "Session has been revoked",
                401,
            )

        user = await self.repository.get_by_id(user_id)

        if not user:
            raise AppException(
                "User not found",
                401,
            )

        if user.get("is_locked"):
            raise AppException(
                "Account is locked",
                403,
            )

        if not user.get("is_active"):
            raise AppException(
                "Account is inactive",
                403,
            )

        access_token = create_access_token(
            subject=str(user["_id"]),
            role=user["role"],
        )

        await self.session_service.update_last_used(
            str(session["_id"])
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
        }

    async def logout_user(
        self,
        refresh_token: str,
    ):
        success = await self.session_service.logout(
            refresh_token
        )

        if not success:
            raise AppException(
                "Invalid or already revoked session",
                401,
            )

        return {
            "message": "Logout successful"
        }