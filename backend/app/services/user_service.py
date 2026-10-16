from datetime import datetime, timezone

from app.core.exceptions import AppException
from app.core.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.roles import UserRole
from app.core.security import hash_password, verify_password
from app.repositories.user_repository import UserRepository
from app.repositories.otp_repository import OTPRepository
from app.services.session_service import SessionService


def resolve_full_name(user: dict) -> str:
    """Login accounts store full_name; employee records store
    first_name/last_name - support both shapes."""
    if user.get("full_name"):
        return user["full_name"]

    return " ".join(
        part
        for part in [
            user.get("first_name", ""),
            user.get("last_name", ""),
        ]
        if part
    ).strip()


class UserService:
    def __init__(self):
        self.repository = UserRepository()
        self.session_service = SessionService()

    async def bootstrap_hr_admin(self, email: str, password: str, full_name: str):
        """Create the one HR account the whole hierarchy hangs off.

        Idempotent: if the email already exists this is a no-op, so it is safe
        to call on every startup.
        """
        email = email.lower().strip()

        if await self.repository.get_by_email(email):
            return None

        now = datetime.utcnow()

        user = await self.repository.create(
            {
                "full_name": full_name.strip(),
                "email": email,
                "phone_number": "",
                "password_hash": hash_password(password),
                "company_name": "",
                "company_address": "",
                "reference": "",
                "role": UserRole.HR_ADMIN.value,
                "is_active": True,
                "is_locked": False,
                "failed_login_attempts": 0,
                "created_at": now,
                "updated_at": now,
            }
        )

        return user

    async def list_manager_accounts(self):
        """Accounts that can be picked as an employee's reporting manager."""
        users = await self.repository.get_admin_accounts()

        return [
            {
                "id": str(user["_id"]),
                "full_name": resolve_full_name(user),
                "email": user["email"],
                "role": user["role"],
            }
            for user in users
        ]

    async def create_manager_account(
        self,
        full_name: str,
        email: str,
        password: str,
    ):
        """Called by HR only - see api/v1/users.create_manager_account."""
        email = email.lower().strip()

        if await self.repository.get_by_email(email):
            raise AppException(
                "User with this email already exists",
                409,
            )

        now = datetime.utcnow()

        return await self.repository.create(
            {
                "full_name": full_name.strip(),
                "email": email,
                "phone_number": "",
                "password_hash": hash_password(password),
                "company_name": "",
                "company_address": "",
                "reference": "",
                "role": UserRole.MANAGER.value,
                "is_active": True,
                "is_locked": False,
                "failed_login_attempts": 0,
                "created_at": now,
                "updated_at": now,
            }
        )

    async def reset_password(
        self,
        email: str,
        reset_token: str,
        new_password: str,
        confirm_password: str,
    ):
        if new_password != confirm_password:
            raise AppException(
                "New password and confirm password do not match",
                400,
            )

        email = email.lower().strip()

        otp_repository = OTPRepository()

        token_record = await otp_repository.collection.find_one(
            {
                "email": email,
                "purpose": "password_reset_authorized",
                "reset_token": reset_token,
            }
        )

        if not token_record:
            raise AppException(
                "Invalid or expired password reset request",
                400,
            )

        now = datetime.now(timezone.utc)

        if now >= token_record["expires_at"]:
            await otp_repository.collection.delete_one(
                {"_id": token_record["_id"]}
            )

            raise AppException(
                "Password reset session has expired. Please request a new OTP.",
                400,
            )

        user = await self.repository.get_by_email(email)

        if not user:
            raise AppException(
                "Invalid password reset request",
                400,
            )

        new_password_hash = hash_password(new_password)

        await self.repository.update(
            str(user["_id"]),
            {
                "password_hash": new_password_hash,
                "updated_at": datetime.now(timezone.utc),
                "failed_login_attempts": 0,
                "is_locked": False,
            },
        )

        # Token can only be used once.
        await otp_repository.collection.delete_one(
            {"_id": token_record["_id"]}
        )

        return {
            "message": "Password reset successfully",
        }

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