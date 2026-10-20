from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, EmailStr

from app.api.deps import get_current_user, require_hr_admin, require_permission
from app.core.roles import Permission, UserRole
from app.schemas.common import APIResponse
from app.schemas.user import ManagerCreate, UserResponse
from app.services.user_service import UserService, resolve_full_name


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


user_service = UserService()


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
    managers = await user_service.list_manager_accounts()

    return APIResponse(
        success=True,
        message="Reporting managers retrieved successfully",
        data=managers,
    )


@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_my_profile(
    current_user: dict = Depends(get_current_user),
):
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