import re
from datetime import datetime, timezone

from app.core.exceptions import AppException
from app.core.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.roles import MANAGED_ADMIN_ROLES, UserRole, role_value
from app.core.security import hash_password, verify_password
from app.repositories.user_repository import UserRepository
from app.repositories.otp_repository import OTPRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.shift_repository import ShiftRepository
from app.services.employee_identity import (
    SUPER_ADMIN_EMPLOYEE_CODE,
    ensure_employee_profile,
)
from app.services.session_service import SessionService
from app.services.object_storage_service import ObjectStorageService
from datetime import date as date_type


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

        # The HR account is also a working employee: mint its employee code
        # at creation so self-attendance and every employee list see it from
        # day one instead of failing with "No employee record found".
        user = await ensure_employee_profile(self.repository.collection, user)

        return user

    @staticmethod
    def _new_login_document(
        full_name: str,
        email: str,
        password: str,
        role: UserRole,
    ) -> dict:
        """Base users document for a fresh, active, unlocked login account.

        The caller normalises the email; the password is stored hashed only.
        """
        now = datetime.utcnow()

        return {
            "full_name": full_name.strip(),
            "email": email,
            "phone_number": "",
            "password_hash": hash_password(password),
            "company_name": "",
            "company_address": "",
            "reference": "",
            "role": role.value,
            "is_active": True,
            "is_locked": False,
            "failed_login_attempts": 0,
            "created_at": now,
            "updated_at": now,
        }

    async def bootstrap_super_admin(
        self,
        email: str,
        password: str,
        full_name: str,
    ):
        """Create the super admin from settings on startup.

        Idempotent like bootstrap_hr_admin. Unlike HR, no employee identity is
        minted - see ensure_employee_profile for why.
        """
        email = email.lower().strip()

        if await self.repository.get_by_email(email):
            return None

        return await self.repository.create(
            self._new_login_document(
                full_name,
                email,
                password,
                UserRole.SUPER_ADMIN,
            )
        )

    # ------------------------------------------------------------------ #
    # Admin account management (super admin only)                        #
    # ------------------------------------------------------------------ #

    async def list_admin_accounts(self) -> list[dict]:
        """HR and manager accounts, including deactivated and locked ones."""
        return await self.repository.list_by_roles(MANAGED_ADMIN_ROLES)

    async def create_admin_account(
        self,
        full_name: str,
        email: str,
        password: str,
        role: UserRole,
    ):
        """Create an HR admin or manager account for the super admin.

        The email OTP is checked by the API route before this is called.
        """
        # Defence in depth behind the schema's Literal: this path must never
        # create another super admin.
        if role.value not in MANAGED_ADMIN_ROLES:
            raise AppException(
                "Only HR admin or manager accounts can be created here",
                400,
            )

        # Managers go through the same path HR uses to create them, so both
        # routes produce identical manager documents.
        if role == UserRole.MANAGER:
            return await self.create_manager_account(
                full_name=full_name,
                email=email,
                password=password,
            )

        email = email.lower().strip()

        if await self.repository.get_by_email(email):
            raise AppException(
                "User with this email already exists",
                409,
            )

        user = await self.repository.create(
            self._new_login_document(full_name, email, password, role)
        )

        # Same as the bootstrapped HR: an HR account is also a working
        # employee, so it gets its employee code up front.
        return await ensure_employee_profile(self.repository.collection, user)

    async def update_admin_account_status(
        self,
        user_id: str,
        is_active: bool | None = None,
        is_locked: bool | None = None,
    ):
        """Activate / deactivate and lock / unlock an HR or manager account.

        Deactivating or locking also revokes every session of that account,
        so the change takes effect immediately rather than when the current
        access token expires.
        """
        user = await self.repository.get_by_id(user_id)

        # Employees and the super admin itself are reported as "not found"
        # rather than forbidden, so this route cannot be used to touch them.
        if not user or role_value(user.get("role")) not in MANAGED_ADMIN_ROLES:
            raise AppException("Admin account not found", 404)

        updates: dict = {}

        if is_active is not None:
            updates["is_active"] = is_active

        if is_locked is not None:
            updates["is_locked"] = is_locked

            # Login auto-locks at 5 failed attempts. Without a reset, the
            # next wrong password after an unlock would lock it again.
            if not is_locked:
                updates["failed_login_attempts"] = 0

        if not updates:
            raise AppException("Nothing to update", 400)

        updates["updated_at"] = datetime.utcnow()

        updated = await self.repository.update(user_id, updates)

        if is_active is False or is_locked is True:
            await self.session_service.revoke_all_sessions_for_user(user_id)

        return updated

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

        # An OTP reset also revokes every active session of this user,
        # so devices that stayed logged in are forced back to the login
        # page with the new password.
        await self.session_service.revoke_all_sessions_for_user(
            str(user["_id"])
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
            updated_user = (
                await self.repository.increment_failed_login_attempts(
                    str(user["_id"])
                )
            )

            if (
                updated_user
                and updated_user.get("failed_login_attempts", 0) >= 5
            ):
                await self.repository.update(
                    str(user["_id"]),
                    {"is_locked": True},
                )

            raise AppException(
                "Invalid email or password",
                401,
            )

        user_id = str(user["_id"])
        role = user["role"]

                # Reset failed-login count after successful authentication.
        if user.get("failed_login_attempts", 0) > 0:
            await self.repository.update(
                user_id,
                {"failed_login_attempts": 0},
            )

        refresh_token = create_refresh_token(
            subject=user_id,
        )

        session = await self.session_service.create_session(
            user_id=user_id,
            refresh_token=refresh_token,
        )

        access_token = create_access_token(
            subject=user_id,
            role=role,
            session_id=str(session["_id"]),
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
            session_id=str(session["_id"]),
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
  
    async def change_password(
        self,
        user_id: str,
        current_password: str,
        new_password: str,
        confirm_password: str,
    ):
        if new_password != confirm_password:
            raise AppException(
                "New password and confirmation do not match",
                400,
            )

        user = await self.repository.get_by_id(user_id)

        if not user:
            raise AppException(
                "User not found",
                404,
            )

        if not verify_password(
            current_password,
            user["password_hash"],
        ):
            raise AppException(
                "Current password is incorrect",
                400,
            )

        if verify_password(new_password, user["password_hash"]):
            raise AppException(
                "New password must be different from the current password",
                400,
            )

        await self.repository.update(
            str(user["_id"]),
            {
                "password_hash": hash_password(new_password),
                "updated_at": datetime.now(timezone.utc),
            },
        )

        # Any password change invalidates every active session for this
        # user (all devices), including the one that made this request -
        # they must log in again with the new password.
        await self.session_service.revoke_all_sessions_for_user(
            str(user["_id"])
        )

        return {
            "message": "Password changed successfully",
        }

    # ------------------------------------------------------------------ #
    # Own profile (admin portal "My Profile" page)                       #
    # ------------------------------------------------------------------ #

    EMPLOYMENT_STATUS_LABELS = {
        "active": "Active",
        "on_leave": "On Leave",
        "inactive": "Inactive",
    }

    async def get_my_profile(self, user: dict) -> dict:
        """Merge the login document with the employee fields it carries (or
        had minted). Names (department, shift, manager) are resolved for
        display; unknown personal fields stay null instead of faked."""
        department = None
        department_head = None

        if user.get("department_id"):
            record = await DepartmentRepository().get_by_id(
                str(user["department_id"])
            )

            if record:
                department = record.get("name")
                department_head = (
                    record.get("head") or record.get("department_head")
                )

        shift = user.get("shift")

        if not shift and user.get("shift_id"):
            record = await ShiftRepository().get_by_id(str(user["shift_id"]))

            if record:
                shift = record.get("name")

        reporting_manager = user.get("reporting_manager")

        if not reporting_manager and user.get("manager_id"):
            manager = await self.repository.get_by_id(str(user["manager_id"]))

            if manager:
                reporting_manager = resolve_full_name(manager)

        phone = user.get("phone") or user.get("phone_number") or None
        address = user.get("address")
        emergency = user.get("emergency_contact") or {}
        status = (user.get("status") or "active").lower()
        avatar_url = None
        if user.get("avatar_key"):
            avatar_url = await ObjectStorageService().signed_url(user["avatar_key"])

        employee_id = user.get("employee_id")

        # Display-only code for the super admin, which never stores an
        # employee_id (see SUPER_ADMIN_EMPLOYEE_CODE).
        if not employee_id and role_value(user.get("role")) == UserRole.SUPER_ADMIN.value:
            employee_id = SUPER_ADMIN_EMPLOYEE_CODE

        return {
            "id": str(user["_id"]),
            "employee_id": employee_id,
            "full_name": resolve_full_name(user),
            "role": user.get("role"),
            "avatar_url": avatar_url,
            "designation": user.get("designation"),
            "department": user.get("department") or department,
            "department_head": department_head,
            "reporting_manager": reporting_manager,
            "work_location": user.get("work_location"),
            "employment_type": user.get("employment_type"),
            "shift": shift,
            "date_of_joining": user.get("joining_date"),
            "employment_status": self.EMPLOYMENT_STATUS_LABELS.get(
                status, "Active"
            ),
            "email": user["email"],
            "phone": phone,
            "office_email": user["email"],
            "work_phone": phone,
            "date_of_birth": user.get("date_of_birth"),
            "gender": user.get("gender"),
            "marital_status": user.get("marital_status"),
            "nationality": user.get("nationality"),
            "blood_group": user.get("blood_group"),
            "permanent_address": user.get("permanent_address") or address,
            "current_address": user.get("current_address") or address,
            "emergency_name": user.get("emergency_name") or emergency.get("name"),
            "emergency_relationship": user.get("emergency_relationship") or emergency.get("relationship"),
            "emergency_phone": user.get("emergency_phone") or emergency.get("phone"),
            "emergency_email": user.get("emergency_email") or emergency.get("email"),
            "updated_at": user.get("updated_at"),
        }

    async def update_my_profile(self, user: dict, data: dict) -> dict:
        """Apply self-service edits to the user document. Only the allow-list
        below is writable - identity fields stay system-owned. Department and
        shift arrive as display names: when the name matches an existing
        record the id is linked, otherwise the name is stored as-is so a
        save never fails just because the picklist differs from master data."""
        updates: dict = {}

        # Names are normally set by whoever manages the account. The super
        # admin has no one above it, so it renames itself here.
        if (
            "full_name" in data
            and role_value(user.get("role")) == UserRole.SUPER_ADMIN.value
        ):
            full_name = " ".join((data["full_name"] or "").split())

            if not full_name:
                raise AppException("Full name is required", 400)

            updates["full_name"] = full_name

        simple_fields = (
            "phone",
            "gender",
            "marital_status",
            "nationality",
            "blood_group",
            "permanent_address",
            "current_address",
            "emergency_name",
            "emergency_relationship",
            "emergency_phone",
            "emergency_email",
            "designation",
            "work_location",
            "employment_type",
        )

        for field in simple_fields:
            if field in data:
                value = data[field]

                updates[field] = value.strip() if isinstance(value, str) else value

        if "date_of_birth" in data:
            updates["date_of_birth"] = self._parse_optional_date(
                data["date_of_birth"], "date of birth"
            )

        for field in ("department", "shift"):
            if field not in data:
                continue

            name = (data[field] or "").strip()

            if not name:
                updates[field] = None
                continue

            repository = (
                DepartmentRepository() if field == "department" else ShiftRepository()
            )

            record = await repository.collection.find_one(
                {
                    "name": {
                        "$regex": "^" + re.escape(name) + "$",
                        "$options": "i",
                    }
                }
            )

            if record:
                updates["{}_id".format(field)] = str(record["_id"])
                updates[field] = record.get("name")
            else:
                updates[field] = name

        if updates:
            updates["updated_at"] = datetime.now(timezone.utc)

            await self.repository.update(str(user["_id"]), updates)

        fresh = await self.repository.get_by_id(str(user["_id"]))

        return await self.get_my_profile(fresh or user)

    @staticmethod
    def _parse_optional_date(value: str | None, label: str) -> datetime | None:
        if value is None or str(value).strip() == "":
            return None

        try:
            parsed = date_type.fromisoformat(str(value).strip())
        except ValueError:
            raise AppException("Enter a valid date for the {}".format(label), 400)

        return datetime(parsed.year, parsed.month, parsed.day)
