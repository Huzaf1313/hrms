from fastapi import APIRouter, Depends, status

from app.api.deps import get_current_user, require_permission
from app.core.roles import Permission
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import UserService


router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


user_service = UserService()


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
async def create_user(
    user_data: UserCreate,
    current_user: dict = Depends(
        require_permission(Permission.USERS_CREATE)
    ),
):
    user = await user_service.create_user(
        full_name=user_data.full_name,
        email=user_data.email,
        password=user_data.password,
        role=user_data.role,
    )

    return UserResponse(
        id=str(user["_id"]),
        employee_id=current_user.get("employee_id"),
        full_name=user["full_name"],
        email=user["email"],
        role=user["role"],
        is_active=user["is_active"],
        is_locked=user["is_locked"],
        created_at=user["created_at"],
        updated_at=user["updated_at"],
    )