from fastapi import APIRouter, status

from app.schemas.user import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    
)
from app.services.user_service import UserService


router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(user_data: UserCreate):
    service = UserService()

    user = await service.register_user(
        full_name=user_data.full_name,
        email=user_data.email,
        phone_number=user_data.phone_number,
        password=user_data.password,
        company_name=user_data.company_name,
        company_address=user_data.company_address,
        reference=user_data.reference,
        role=user_data.role,
    )

    user["id"] = str(user["_id"])
    del user["_id"]

    return user

@router.post(
    "/login",
    response_model=TokenResponse,
)
async def login(login_data: LoginRequest):
    service = UserService()

    return await service.login_user(
        email=login_data.email,
        password=login_data.password,
    )

@router.post(
    "/refresh",
    response_model=TokenResponse,
)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
):
    service = UserService()

    return await service.refresh_access_token(
        refresh_token=refresh_data.refresh_token,
    )

@router.post(
    "/logout",
)
async def logout(
    refresh_data: RefreshTokenRequest,
):
    service = UserService()

    return await service.logout_user(
        refresh_token=refresh_data.refresh_token,
    )