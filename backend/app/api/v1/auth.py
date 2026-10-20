from fastapi import APIRouter, status, Depends

from app.schemas.user import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyPasswordResetOTPRequest,
)
from app.services.user_service import UserService
from app.services.otp_service import OTPService


from app.api.deps import get_current_user
from app.schemas.user import ChangePasswordRequest

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

# There is no public sign-up. The first HR account is bootstrapped from
# BOOTSTRAP_HR_* on startup, managers are created by HR through
# POST /api/v1/users, and employees are created through POST /api/v1/employees
# with shared credentials. Nothing here can mint an account.


@router.post(
    "/forgot-password",
)
async def forgot_password(
    request: ForgotPasswordRequest,
):
    otp_service = OTPService()

    return await otp_service.create_password_reset_otp(
        email=request.email,
    )


@router.post(
    "/forgot-password/verify-otp",
)
async def verify_password_reset_otp(
    request: VerifyPasswordResetOTPRequest,
):
    otp_service = OTPService()

    return await otp_service.verify_password_reset_otp(
        email=request.email,
        otp=request.otp,
    )


@router.post(
    "/forgot-password/reset-password",
)
async def reset_password(
    request: ResetPasswordRequest,
):
    user_service = UserService()

    return await user_service.reset_password(
        email=request.email,
        reset_token=request.reset_token,
        new_password=request.new_password,
        confirm_password=request.confirm_password,
    )


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

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: dict = Depends(get_current_user),
):
    user_service = UserService()

    return await user_service.change_password(
        user_id=str(current_user["_id"]),
        current_password=request.current_password,
        new_password=request.new_password,
        confirm_password=request.confirm_password,
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
