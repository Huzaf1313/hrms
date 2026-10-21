from fastapi import APIRouter, status

from app.schemas.user import (
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    VerifyOTPRequest,
    VerifyPasswordResetOTPRequest,
)
from app.services.user_service import UserService
from app.services.otp_service import OTPService
from app.core.exceptions import AppException

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"],
)

@router.post(
    "/register/request-otp",
)
async def request_registration_otp(user_data: UserCreate):
    service = UserService()

    # Check whether the email is already registered.
    existing_user = await service.repository.get_by_email(
        user_data.email.lower().strip()
    )

    if existing_user:
        raise AppException(
            "User with this email already exists",
            409,
        )

    otp_service = OTPService()

    return await otp_service.create_registration_otp(
        full_name=user_data.full_name,
        email=user_data.email,
        phone_number=user_data.phone_number,
        password=user_data.password,
        role=user_data.role.value,
        company_name=user_data.company_name,
        company_address=user_data.company_address,
        reference=user_data.reference,
    )

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
    "/register/verify-otp",
)
async def verify_registration_otp(
    otp_data: VerifyOTPRequest,
):
    otp_service = OTPService()

    registration_data = await otp_service.verify_registration_otp(
        email=otp_data.email,
        otp=otp_data.otp,
    )

    user_service = UserService()

    user = await user_service.create_verified_user(
        registration_data
    )

    user["id"] = str(user["_id"])
    del user["_id"]

    return {
        "message": "Registration successful",
        "user": user,
    }

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