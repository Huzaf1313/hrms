from datetime import date, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import RedirectResponse

from app.api.deps import get_current_user, require_permission
from app.core.cache import (
    get_cache,
    invalidate_employees_cache,
    invalidate_payroll_analytics_cache,
    set_cache,
)
from app.core.roles import Permission, has_permission, UserRole
from app.core.common_schemas import APIResponse
from app.modules.employees.schemas import (
    EmployeeCreate,
    EmployeeCredentials,
    EmployeeOTPRequest,
    EmployeeOTPRequestResponse,
    EmployeeOTPVerifyRequest,
    EmployeeOTPVerifyResponse,
    EmployeeResponse,
    EmployeeUpdate,
)
from app.modules.employees.service import EmployeeService
from app.modules.employees.identity import (
    ensure_employee_profile,
    peek_next_employee_code,
    SUPER_ADMIN_EMPLOYEE_CODE,
)
from app.modules.auth.otp_service import OTPService
from app.modules.employees.object_storage_service import ObjectStorageService
from app.utils.employee_storage import employee_profile_key
from app.utils.pagination import PaginationParams
from app.core.exceptions import AppException

EMPLOYEE_PROFILE_CACHE_TTL = 300
EMPLOYEE_LIST_CACHE_TTL = 180

router = APIRouter()

service = EmployeeService()
otp_service = OTPService()
storage_service = ObjectStorageService()

MAX_AVATAR_SIZE = 5 * 1024 * 1024
AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def to_datetime(value: date | None) -> datetime | None:
    """Mongo/BSON only stores datetime, not bare date - convert before saving."""
    if value is None:
        return None

    return datetime(value.year, value.month, value.day)


async def serialize_employee(
    employee: dict,
    welcome_email_sent: bool | None = None,
) -> EmployeeResponse:
    avatar_url = employee.get("avatar_url")
    # Employee self-service uploads use profile_photo_key, while admin
    # uploads use avatar_key. Both point to the same private object storage and
    # must be exposed as signed URLs for <img> requests in the admin UI.
    try:
        photo_key = employee.get("avatar_key") or employee.get("profile_photo_key")
        if photo_key:
            avatar_url = await storage_service.signed_url(photo_key)
    except Exception:
        avatar_url = employee.get("avatar_url")

    first_name = employee.get("first_name") or ""
    last_name = employee.get("last_name") or ""
    if not first_name and employee.get("full_name"):
        parts = employee["full_name"].strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

    joining_date = employee.get("joining_date")
    if not joining_date and employee.get("created_at"):
        created_at = employee["created_at"]
        if hasattr(created_at, "date"):
            joining_date = created_at.date()
        elif isinstance(created_at, str):
            try:
                joining_date = date.fromisoformat(created_at[:10])
            except Exception:
                joining_date = None

    date_of_birth = employee.get("date_of_birth")
    if date_of_birth and hasattr(date_of_birth, "date"):
        date_of_birth = date_of_birth.date()
    elif isinstance(date_of_birth, str):
        try:
            date_of_birth = date.fromisoformat(date_of_birth[:10])
        except Exception:
            date_of_birth = None

    emergency_contact = employee.get("emergency_contact")
    if emergency_contact and not isinstance(emergency_contact, dict):
        emergency_contact = None

    bank_information = employee.get("bank_information")
    if bank_information and not isinstance(bank_information, dict):
        bank_information = None

    email = employee.get("email") or "user@hrms.com"

    return EmployeeResponse(
        id=str(employee["_id"]),
        employee_id=employee.get("employee_id") or "",
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=employee.get("phone") or employee.get("phone_number") or "",
        avatar_url=avatar_url,
        date_of_birth=date_of_birth,
        gender=employee.get("gender"),
        address=employee.get("address"),
        department_id=employee.get("department_id") or "",
        designation=employee.get("designation") or "",
        joining_date=joining_date,
        employment_type=employee.get("employment_type") or "Full-time",
        work_location=employee.get("work_location"),
        reporting_manager=employee.get("reporting_manager"),
        manager_id=employee.get("manager_id"),
        salary_structure=employee.get("salary_structure"),
        salary=employee.get("salary"),
        shift_id=employee.get("shift_id"),
        emergency_contact=emergency_contact,
        bank_information=bank_information,
        status=employee.get("status") or "active",
        created_by=employee.get("created_by"),
        welcome_email_sent=welcome_email_sent,
    )


@router.get(
    "/employees/next-id",
    response_model=APIResponse[dict[str, str]],
)
async def get_next_employee_id(
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_CREATE)),
):
    """Preview of the ID the next employee will get. Nothing is reserved."""
    code = await peek_next_employee_code(service.user_repository.collection)

    return APIResponse(
        success=True,
        message="Next employee ID retrieved successfully",
        data={"employee_id": code},
    )


@router.post(
    "/employees/request-email-otp",
    response_model=APIResponse[EmployeeOTPRequestResponse],
)
async def request_employee_email_otp(
    data: EmployeeOTPRequest,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_CREATE)),
):
    result = await otp_service.create_employee_verification_otp(
        email=data.email,
        admin_id=str(current_user["_id"]),
    )

    return APIResponse(
        success=True,
        message=result["message"],
        data=EmployeeOTPRequestResponse(**result),
    )


@router.post(
    "/employees/verify-email-otp",
    response_model=APIResponse[EmployeeOTPVerifyResponse],
)
async def verify_employee_email_otp(
    data: EmployeeOTPVerifyRequest,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_CREATE)),
):
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
    "/employees",
    response_model=APIResponse[EmployeeResponse],
)
async def create_employee(
    data: EmployeeCreate,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_CREATE)),
):
    employee_data = data.model_dump()
    employee_data["date_of_birth"] = to_datetime(employee_data.get("date_of_birth"))
    employee_data["joining_date"] = to_datetime(employee_data["joining_date"])

    employee, temporary_password, welcome_email_sent = await service.create_employee(
        employee_data,
        current_user=current_user,
    )

    await invalidate_employees_cache()
    await invalidate_payroll_analytics_cache()

    response = await serialize_employee(employee, welcome_email_sent=welcome_email_sent)
    response.credentials = EmployeeCredentials(
        email=response.email,
        temporary_password=temporary_password,
    )

    message = (
        "Employee created successfully. Welcome email sent."
        if welcome_email_sent
        else "Employee created successfully (welcome email delivery failed)."
    )

    return APIResponse(
        success=True,
        message=message,
        data=response,
    )


@router.get(
    "/employees",
    response_model=APIResponse[list[EmployeeResponse]],
)
async def get_employees(
    search: str | None = Query(default=None),
    department_id: str | None = Query(default=None),
    status: str | None = Query(default=None),
    filter: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_READ)),
):
    page_val = page if isinstance(page, int) else 1
    limit_val = limit if isinstance(limit, int) else 10
    search_val = search if isinstance(search, str) else None
    dept_val = department_id if isinstance(department_id, str) else None
    status_val = status if isinstance(status, str) else None
    filter_val = filter if isinstance(filter, str) else None

    role = getattr(current_user.get("role"), "value", current_user.get("role"))
    scope = f"mgr_{current_user.get('_id')}" if role == "manager" else "hr"
    search_str = search_val.strip().lower() if search_val else "none"
    cache_key = f"employees:list:{scope}:{dept_val or 'all'}:{status_val or 'all'}:{filter_val or 'all'}:{search_str}:{page_val}:{limit_val}"

    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Employees retrieved successfully",
                data=[EmployeeResponse(**item) for item in cached],
            )
        except Exception:
            pass

    pagination = PaginationParams(page=page_val, limit=limit_val)

    employees = await service.get_employees(
        search=search_val,
        department_id=dept_val,
        status=status_val,
        pagination=pagination,
        current_user=current_user,
        special_filter=filter_val,
    )

    serialized = [await serialize_employee(employee) for employee in employees]
    await set_cache(
        cache_key,
        [item.model_dump(mode="json") for item in serialized],
        ttl=EMPLOYEE_LIST_CACHE_TTL,
    )

    return APIResponse(
        success=True,
        message="Employees retrieved successfully",
        data=serialized,
    )

@router.get(
    "/employees/me",
    response_model=APIResponse[EmployeeResponse],
)
async def get_my_employee_profile(
    current_user: dict = Depends(get_current_user),
):
    try:
        current_user = await ensure_employee_profile(
            service.user_repository.collection,
            current_user,
        )
    except Exception as e:
        print(f"[employees/me] ensure_employee_profile warning: {e}")

    if not current_user.get("employee_id"):
        role = getattr(current_user.get("role"), "value", current_user.get("role"))
        emp_code = (
            SUPER_ADMIN_EMPLOYEE_CODE
            if role == UserRole.SUPER_ADMIN.value
            else f"EMP_{str(current_user.get('_id'))[-4:]}"
        )
        current_user = dict(current_user)
        current_user["employee_id"] = emp_code
        if not current_user.get("designation"):
            current_user["designation"] = (
                role.replace("_", " ").title()
                if isinstance(role, str)
                else "Employee"
            )

    user_id = str(current_user["_id"])
    cache_key = f"employees:me:{user_id}"
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Employee profile retrieved successfully",
                data=EmployeeResponse(**cached),
            )
        except Exception:
            pass

    response_data = await serialize_employee(current_user)
    try:
        await set_cache(cache_key, response_data.model_dump(mode="json"), ttl=EMPLOYEE_PROFILE_CACHE_TTL)
    except Exception:
        pass

    return APIResponse(
        success=True,
        message="Employee profile retrieved successfully",
        data=response_data,
    )

@router.get(
    "/employees/{employee_id}",
    response_model=APIResponse[EmployeeResponse],
)
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_READ)),
):
    role = getattr(current_user.get("role"), "value", current_user.get("role"))
    scope = f"mgr_{current_user.get('_id')}" if role == "manager" else ("emp_" + str(current_user.get("_id")) if role == "employee" else "hr")
    cache_key = f"employees:profile:{employee_id}:{scope}"
    cached = await get_cache(cache_key)
    if cached is not None:
        try:
            return APIResponse(
                success=True,
                message="Employee retrieved successfully",
                data=EmployeeResponse(**cached),
            )
        except Exception:
            pass

    employee = await service.get_employee(
        employee_id=employee_id,
        current_user=current_user,
    )

    response_data = await serialize_employee(employee)
    await set_cache(cache_key, response_data.model_dump(mode="json"), ttl=EMPLOYEE_PROFILE_CACHE_TTL)

    return APIResponse(
        success=True,
        message="Employee retrieved successfully",
        data=response_data,
    )


@router.post(
    "/employees/{employee_id}/avatar",
    response_model=APIResponse[EmployeeResponse],
)
async def upload_employee_avatar(
    employee_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    role = getattr(current_user.get("role"), "value", current_user.get("role"))
    current_user_id = str(current_user.get("_id") or "")
    current_emp_code = str(current_user.get("employee_id") or "")

    is_self = (
        employee_id in (current_user_id, current_emp_code)
        or employee_id == "me"
    )

    if not is_self and not has_permission(role, Permission.EMPLOYEES_UPDATE):
        raise AppException(
            "You do not have permission to perform this action",
            403,
        )

    target_id = current_user_id if employee_id == "me" else employee_id
    employee = await service.get_employee(target_id, current_user=current_user)
    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()

    if extension not in AVATAR_EXTENSIONS:
        raise AppException("Profile photo must be JPG, JPEG, or PNG", 400)

    contents = await file.read(MAX_AVATAR_SIZE + 1)
    await file.close()

    if not contents:
        raise AppException("Please select a profile photo", 400)

    if len(contents) > MAX_AVATAR_SIZE:
        raise AppException("Profile photo must not exceed 5 MB", 413)

    signatures = {
        ".jpg": contents.startswith(b"\xff\xd8\xff"),
        ".jpeg": contents.startswith(b"\xff\xd8\xff"),
        ".png": contents.startswith(b"\x89PNG\r\n\x1a\n"),
    }
    if not signatures.get(extension, False):
        raise AppException("The selected file is not a valid image", 400)

    key = employee_profile_key(employee, extension)
    await storage_service.upload(
        key=key,
        body=contents,
        content_type=file.content_type or "image/*",
        content_length=len(contents),
    )

    old_key = employee.get("avatar_key") or employee.get("profile_photo_key")
    updated = await service.repository.update(
        target_id,
        {"avatar_key": key, "profile_photo_key": key, "avatar_url": None, "updated_at": datetime.utcnow()},
        scope=service._visibility_scope(current_user),
    )

    if old_key and old_key != key:
        await storage_service.delete(old_key)

    await invalidate_employees_cache(employee_id=target_id)

    return APIResponse(
        success=True,
        message="Profile photo uploaded successfully",
        data=await serialize_employee(updated),
    )


@router.post(
    "/employee-profile-photo/me",
    response_model=APIResponse[EmployeeResponse],
)
async def upload_my_employee_profile_photo(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    return await upload_employee_avatar(
        employee_id="me",
        file=file,
        current_user=current_user,
    )


@router.delete(
    "/employee-profile-photo/me",
    response_model=APIResponse[EmployeeResponse],
)
async def delete_my_employee_profile_photo(
    current_user: dict = Depends(get_current_user),
):
    return await delete_employee_avatar(
        employee_id="me",
        current_user=current_user,
    )


@router.get(
    "/employee-profile-photo/{employee_id}/image",
)
async def get_employee_profile_photo_image(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    target_id = str(current_user["_id"]) if employee_id == "me" else employee_id
    employee = await service.get_employee(target_id, current_user=current_user)
    photo_key = employee.get("avatar_key") or employee.get("profile_photo_key")
    if not photo_key:
        raise AppException("No profile photo found", 404)
    url = await storage_service.signed_url(photo_key)
    return RedirectResponse(url=url, status_code=307)


@router.put(
    "/employees/{employee_id}",
    response_model=APIResponse[EmployeeResponse],
)
async def update_employee(
    employee_id: str,
    data: EmployeeUpdate,
    current_user: dict = Depends(get_current_user),
):
    role = getattr(current_user.get("role"), "value", current_user.get("role"))
    current_user_id = current_user.get("_id")
    current_emp_code = current_user.get("employee_id")

    # Employee users can only update their own emergency contact
    if role == "employee":
        if not current_user_id:
            raise AppException(
                "Employee profile not found",
                404,
            )

        is_own_profile = (
            str(current_user_id) == str(employee_id)
            or (current_emp_code and str(current_emp_code) == str(employee_id))
            or employee_id == "me"
        )

        if not is_own_profile:
            raise AppException(
                "You can only update your own employee profile",
                403,
            )

        update_data = data.model_dump(exclude_unset=True)

        allowed_fields = {"emergency_contact"}

        if not set(update_data).issubset(allowed_fields):
            raise AppException(
                "Employees can only update emergency contact details",
                403,
            )

    # HR/Admin/Manager continue using normal permissions
    else:
        if not has_permission(role, Permission.EMPLOYEES_UPDATE):
            raise AppException(
                "You do not have permission to perform this action",
                403,
            )

        update_data = data.model_dump(exclude_unset=True)

        if "date_of_birth" in update_data:
            update_data["date_of_birth"] = to_datetime(
                update_data.get("date_of_birth")
            )

        if "joining_date" in update_data:
            update_data["joining_date"] = to_datetime(
                update_data.get("joining_date")
            )

    target_id = str(current_user_id) if employee_id == "me" else employee_id

    employee = await service.update_employee(
        employee_id=target_id,
        update_data=update_data,
        current_user=current_user,
    )

    await invalidate_employees_cache(employee_id=target_id, user_id=str(current_user_id))
    await invalidate_payroll_analytics_cache()

    return APIResponse(
        success=True,
        message="Employee updated successfully",
        data=await serialize_employee(employee),
    )


@router.delete(
    "/employees/{employee_id}/avatar",
    response_model=APIResponse[EmployeeResponse],
)
async def delete_employee_avatar(
    employee_id: str,
    current_user: dict = Depends(get_current_user),
):
    role = getattr(current_user.get("role"), "value", current_user.get("role"))
    current_user_id = str(current_user.get("_id") or "")
    current_emp_code = str(current_user.get("employee_id") or "")

    is_self = (
        employee_id in (current_user_id, current_emp_code)
        or employee_id == "me"
    )

    if not is_self and not has_permission(role, Permission.EMPLOYEES_UPDATE):
        raise AppException(
            "You do not have permission to perform this action",
            403,
        )

    target_id = current_user_id if employee_id == "me" else employee_id
    employee = await service.get_employee(target_id, current_user=current_user)
    old_key = employee.get("avatar_key") or employee.get("profile_photo_key")

    updated = await service.repository.update(
        target_id,
        {"avatar_key": None, "profile_photo_key": None, "avatar_url": None, "updated_at": datetime.utcnow()},
        scope=service._visibility_scope(current_user),
    )

    if old_key:
        await storage_service.delete(old_key)

    await invalidate_employees_cache(employee_id=target_id)

    return APIResponse(
        success=True,
        message="Profile photo removed successfully",
        data=await serialize_employee(updated),
    )


@router.patch(
    "/employees/{employee_id}/deactivate",
    response_model=APIResponse[EmployeeResponse],
)
async def deactivate_employee(
    employee_id: str,
    current_user: dict = Depends(
        require_permission(Permission.EMPLOYEES_UPDATE)
    ),
):
    employee = await service.deactivate_employee(
        employee_id=employee_id,
        current_user=current_user,
    )

    await invalidate_employees_cache(employee_id=employee_id)
    await invalidate_payroll_analytics_cache()

    return APIResponse(
        success=True,
        message="Employee deactivated successfully",
        data=await serialize_employee(employee),
    )

@router.delete(
    "/employees/{employee_id}",
    response_model=APIResponse[None],
)
async def delete_employee(
    employee_id: str,
    current_user: dict = Depends(require_permission(Permission.EMPLOYEES_DELETE)),
):
    await service.delete_employee(
        employee_id=employee_id,
        current_user=current_user,
    )

    await invalidate_employees_cache(employee_id=employee_id)
    await invalidate_payroll_analytics_cache()

    return APIResponse(
        success=True,
        message="Employee deleted successfully",
        data=None,
    )
