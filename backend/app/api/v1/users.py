from datetime import datetime
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile, status
from pydantic import BaseModel, EmailStr

from app.api.deps import (
    get_current_user,
    require_hr_admin,
    require_permission,
    require_super_admin,
)
from app.core.roles import Permission, UserRole
from app.schemas.common import APIResponse
from app.schemas.employee import (
    EmployeeOTPRequest,
    EmployeeOTPRequestResponse,
    EmployeeOTPVerifyRequest,
    EmployeeOTPVerifyResponse,
)
from app.schemas.user import (
    AdminAccountCreate,
    AdminAccountResponse,
    AdminAccountStatusUpdate,
    AdminProfileResponse,
    AdminProfileUpdate,
    ManagerCreate,
    UserResponse,
)
from app.services.user_service import UserService, resolve_full_name
from app.core.cache import (
    get_cache,
    set_cache,
    invalidate_employees_cache,
    invalidate_managers_cache,
)
from app.services.employee_identity import ensure_employee_profile
from app.services.object_storage_service import ObjectStorageService
from app.services.email_service import EmailService
from app.services.otp_service import OTPService
from app.utils.employee_storage import employee_profile_key
from app.core.config import settings
from app.core.exceptions import AppException

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)

user_service = UserService()
storage_service = ObjectStorageService()
email_service = EmailService()
otp_service = OTPService()

MAX_PROFILE_PHOTO_SIZE = 5 * 1024 * 1024
PROFILE_PHOTO_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MANAGERS_CACHE_TTL = 600


class ManagerAccount(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    role: UserRole


@router.get(
    "/managers",
    response_model=APIResponse[list[ManagerAccount]],
)
async def list_manager_accounts(
    current_user: dict = Depends(
        require_permission(Permission.USERS_READ)
    ),
):
    cache_key = "users:managers:list"

    cached_data = await get_cache(cache_key)
    if cached_data is not None:
        try:
            cached_models = [ManagerAccount(**item) for item in cached_data]
            return APIResponse(
                success=True,
                message="Reporting managers retrieved successfully",
                data=cached_models,
            )
        except Exception:
            pass

    managers = await user_service.list_manager_accounts()
    await set_cache(
        cache_key,
        [m.model_dump() if hasattr(m, "model_dump") else m for m in managers],
        ttl=MANAGERS_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Reporting managers retrieved successfully",
        data=managers,
    )


async def send_admin_welcome_email(account: dict, creator: dict) -> bool:
    """Welcome email for a new HR admin / manager. Never raises: the account
    already exists, so an SMTP problem must not fail the request. The email
    carries the sign-in link only - the password is shared by the creator."""
    company_name = creator.get("company_name") or "HRMS"

    try:
        await email_service.send_html_email_async(
            to_email=account["email"],
            subject=f"Welcome to {company_name}!",
            template_name="emails/welcome_email.html",
            template_data={
                "company_name": company_name,
                "employee_name": resolve_full_name(account),
                "hr_team": "HR Team",
                "login_url": settings.login_url,
            },
        )
        return True
    except Exception as exc:
        logger.warning(
            "Welcome email could not be delivered to %s: %s",
            account.get("email"),
            type(exc).__name__,
        )
        return False


def serialize_admin_account(
    user: dict,
    welcome_email_sent: bool | None = None,
) -> AdminAccountResponse:
    """Row for the super admin's Admin Accounts page. welcome_email_sent is
    passed only by the create route; list and status responses leave it None."""
    return AdminAccountResponse(
        welcome_email_sent=welcome_email_sent,
        id=str(user["_id"]),
        employee_id=user.get("employee_id"),
        full_name=resolve_full_name(user),
        email=user["email"],
        role=user["role"],
        is_active=user.get("is_active", True),
        is_locked=user.get("is_locked", False),
        created_at=user.get("created_at"),
        updated_at=user.get("updated_at"),
    )


@router.get(
    "/admin-accounts",
    response_model=APIResponse[list[AdminAccountResponse]],
)
async def list_admin_accounts(
    current_user: dict = Depends(require_super_admin),
):
    """Every HR admin and manager account, for the super admin."""
    accounts = await user_service.list_admin_accounts()

    return APIResponse(
        success=True,
        message="Admin accounts retrieved successfully",
        data=[serialize_admin_account(account) for account in accounts],
    )


@router.post(
    "/admin-accounts/request-email-otp",
    response_model=APIResponse[EmployeeOTPRequestResponse],
)
async def request_admin_account_email_otp(
    data: EmployeeOTPRequest,
    current_user: dict = Depends(require_super_admin),
):
    """Email a one-time code to the address of the account being created."""
    # Reuses the employee-verification OTP flow; account_label only swaps the
    # "employee" wording in the email for "admin".
    result = await otp_service.create_employee_verification_otp(
        email=data.email,
        admin_id=str(current_user["_id"]),
        account_label="admin",
    )

    return APIResponse(
        success=True,
        message=result["message"],
        data=EmployeeOTPRequestResponse(**result),
    )


@router.post(
    "/admin-accounts/verify-email-otp",
    response_model=APIResponse[EmployeeOTPVerifyResponse],
)
async def verify_admin_account_email_otp(
    data: EmployeeOTPVerifyRequest,
    current_user: dict = Depends(require_super_admin),
):
    """Check the emailed code and return a short-lived verification token.

    The token is bound to this email and to the super admin who verified it,
    and create_admin_account must present it.
    """
    result = await otp_service.verify_employee_verification_otp(
        email=data.email,
        otp=data.otp,
        admin_id=str(current_user["_id"]),
    )

    return APIResponse(
        success=True,
        message=result["message"],
        data=EmployeeOTPVerifyResponse(**result),
    )


@router.post(
    "/admin-accounts",
    response_model=APIResponse[AdminAccountResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_admin_account(
    data: AdminAccountCreate,
    current_user: dict = Depends(require_super_admin),
):
    """Create an HR admin or manager account with an OTP-verified email.

    The password is set by the super admin and shared out of band; the
    welcome email only carries the sign-in link.
    """
    # The schema defaults the token to "", so check it here. The OTP service
    # would also reject it, but with employee-specific wording.
    if not data.email_verification_token.strip():
        raise AppException(
            "Verify the email address with an OTP before creating the account.",
            400,
        )

    # Checked before the one-time token is consumed, so a duplicate email
    # does not burn a verification that could not have been used anyway.
    if await user_service.repository.get_by_email(data.email.lower().strip()):
        raise AppException("User with this email already exists", 409)

    await otp_service.consume_employee_email_verification(
        token=data.email_verification_token,
        submitted_email=data.email,
        admin_id=str(current_user["_id"]),
    )

    account = await user_service.create_admin_account(
        full_name=data.full_name,
        email=data.email,
        password=data.password,
        role=UserRole(data.role),
    )

    # A new HR admin or manager is immediately pickable as a reporting
    # manager. A cache failure is logged only: the account already exists.
    try:
        await invalidate_managers_cache()
    except Exception as exc:
        logger.error("Failed to invalidate manager cache after create: %s", exc)

    welcome_email_sent = await send_admin_welcome_email(account, current_user)

    return APIResponse(
        success=True,
        message="Admin account created successfully",
        data=serialize_admin_account(account, welcome_email_sent),
    )


@router.patch(
    "/admin-accounts/{user_id}/status",
    response_model=APIResponse[AdminAccountResponse],
)
async def update_admin_account_status(
    user_id: str,
    data: AdminAccountStatusUpdate,
    current_user: dict = Depends(require_super_admin),
):
    """Activate / deactivate or lock / unlock an HR admin or manager."""
    account = await user_service.update_admin_account_status(
        user_id=user_id,
        is_active=data.is_active,
        is_locked=data.is_locked,
    )

    # Inactive or locked accounts drop out of the reporting-manager list.
    try:
        await invalidate_managers_cache()
    except Exception as exc:
        logger.error("Failed to invalidate manager cache after status change: %s", exc)

    return APIResponse(
        success=True,
        message="Admin account updated successfully",
        data=serialize_admin_account(account),
    )


@router.delete(
    "/admin-accounts/{user_id}",
    response_model=APIResponse[None],
)
async def delete_admin_account(
    user_id: str,
    current_user: dict = Depends(require_super_admin),
):
    """Permanently delete an HR admin or manager account (super admin only).

    Refused with 409 while a manager still has employees assigned.
    """
    account = await user_service.delete_admin_account(user_id)

    # The account was also a reporting-manager option and an Employees row.
    try:
        await invalidate_managers_cache()
        await invalidate_employees_cache(user_id=user_id)
    except Exception as exc:
        logger.error("Failed to invalidate caches after deleting admin account: %s", exc)

    return APIResponse(
        success=True,
        message=f"{resolve_full_name(account)}'s account was deleted",
        data=None,
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
):
    current_user = await ensure_employee_profile(
        user_service.repository.collection,
        current_user,
    )

    return UserResponse(
        id=str(current_user["_id"]),
        employee_id=current_user.get("employee_id"),
        full_name=resolve_full_name(current_user),
        email=current_user["email"],
        role=current_user["role"],
        is_active=current_user.get("is_active", True),
        is_locked=current_user.get("is_locked", False),
        created_at=current_user["created_at"],
        updated_at=current_user["updated_at"],
    )


@router.get(
    "/me/profile",
    response_model=AdminProfileResponse,
)
async def get_my_admin_profile(
    current_user: dict = Depends(
        require_permission(Permission.SELF_PROFILE_READ)
    ),
):
    """The admin My Profile page's read model. Shaped like the page's
    AdminProfile type so the service swap stays one-to-one."""
    current_user = await ensure_employee_profile(
        user_service.repository.collection,
        current_user,
    )
    profile = await user_service.get_my_profile(current_user)

    return AdminProfileResponse(**profile)


@router.patch(
    "/me/profile",
    response_model=AdminProfileResponse,
)
async def update_my_admin_profile(
    data: AdminProfileUpdate,
    current_user: dict = Depends(
        require_permission(Permission.SELF_PROFILE_UPDATE)
    ),
):
    """Self-service edits only - identity fields are ignored by the
    allow-list in the service, no matter what the body carries."""
    current_user = await ensure_employee_profile(
        user_service.repository.collection,
        current_user,
    )
    profile = await user_service.update_my_profile(
        current_user,
        data.model_dump(exclude_unset=True),
    )

    return AdminProfileResponse(**profile)


@router.post(
    "/me/profile/avatar",
    response_model=AdminProfileResponse,
)
async def upload_my_profile_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(
        require_permission(Permission.SELF_PROFILE_UPDATE)
    ),
):
    employee = await ensure_employee_profile(
        user_service.repository.collection,
        current_user,
    )
    extension = Path(file.filename or "").suffix.lower()

    if extension not in PROFILE_PHOTO_EXTENSIONS:
        raise AppException("Profile photo must be JPG, JPEG, or PNG", 400)

    contents = await file.read(MAX_PROFILE_PHOTO_SIZE + 1)
    await file.close()

    if not contents:
        raise AppException("Please select a profile photo", 400)
    if len(contents) > MAX_PROFILE_PHOTO_SIZE:
        raise AppException("Profile photo must not exceed 5 MB", 413)

    signatures = {
        ".jpg": contents.startswith(b"\xff\xd8\xff"),
        ".jpeg": contents.startswith(b"\xff\xd8\xff"),
        ".png": contents.startswith(b"\x89PNG\r\n\x1a\n"),
    }
    if not signatures[extension]:
        raise AppException("The selected file is not a valid image", 400)

    key = employee_profile_key(employee, extension)
    await storage_service.upload(
        key=key,
        body=contents,
        content_type=file.content_type or "image/*",
        content_length=len(contents),
    )

    old_key = employee.get("avatar_key")
    updated = await user_service.repository.update(
        str(employee["_id"]),
        {
            "avatar_key": key,
            "avatar_url": None,
            "updated_at": datetime.utcnow(),
        },
    )
    if old_key and old_key != key:
        await storage_service.delete(old_key)

    return AdminProfileResponse(**await user_service.get_my_profile(updated))


@router.delete(
    "/me/profile/avatar",
    response_model=AdminProfileResponse,
)
async def delete_my_profile_avatar(
    current_user: dict = Depends(
        require_permission(Permission.SELF_PROFILE_UPDATE)
    ),
):
    employee = await ensure_employee_profile(
        user_service.repository.collection,
        current_user,
    )
    old_key = employee.get("avatar_key")
    updated = await user_service.repository.update(
        str(employee["_id"]),
        {
            "avatar_key": None,
            "avatar_url": None,
            "updated_at": datetime.utcnow(),
        },
    )
    if old_key:
        await storage_service.delete(old_key)

    return AdminProfileResponse(**await user_service.get_my_profile(updated))


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_manager_account(
    user_data: ManagerCreate,
    current_user: dict = Depends(require_hr_admin),
):
    """HR is the only role that can mint admin accounts. Managers are created
    here and then appear in the employee form's reporting-manager list."""
    user = await user_service.create_manager_account(
        full_name=user_data.full_name,
        email=user_data.email,
        password=user_data.password,
    )

    try:
        await invalidate_managers_cache()
    except Exception as exc:
        logger.error("Failed to invalidate manager cache after create: %s", exc)

    return UserResponse(
        id=str(user["_id"]),
        employee_id=None,
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
        is_active=user["is_active"],
        is_locked=user["is_locked"],
        created_at=user["created_at"],
        updated_at=user["updated_at"],
    )
