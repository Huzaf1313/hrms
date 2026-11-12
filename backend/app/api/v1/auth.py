from fastapi import APIRouter, Cookie, Depends, Response
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException
from app.schemas.user import (
    AccessTokenResponse,
    ForgotPasswordRequest,
    LoginRequest,
    ResetPasswordRequest,
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

# The refresh token lives in an HttpOnly cookie so page scripts can never
# read it. It is scoped to the auth routes: only refresh and logout need it.
REFRESH_COOKIE = "hrms_refresh_token"
REFRESH_COOKIE_PATH = "/api/v1/auth"


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE.lower(),
    )


def clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE.lower(),
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
    "/login",
    response_model=AccessTokenResponse,
)
async def login(login_data: LoginRequest, response: Response):
    service = UserService()

    tokens = await service.login_user(
        email=login_data.email,
        password=login_data.password,
    )

    set_refresh_cookie(response, tokens["refresh_token"])

    return AccessTokenResponse(access_token=tokens["access_token"])

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
    response_model=AccessTokenResponse,
)
async def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
):
    if not refresh_token:
        raise AppException("Session expired. Please log in again.", 401)

    service = UserService()

    try:
        tokens = await service.refresh_access_token(
            refresh_token=refresh_token,
        )
    except AppException as exc:
        # A dead cookie would otherwise be re-sent on every page load. It is
        # cleared on the error response itself, because the injected
        # `response` is discarded once an exception is raised.
        failure = JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "message": exc.message, "data": None},
        )
        clear_refresh_cookie(failure)
        return failure

    set_refresh_cookie(response, tokens["refresh_token"])

    return AccessTokenResponse(access_token=tokens["access_token"])


@router.post(
    "/logout",
)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
):
    clear_refresh_cookie(response)

    # Logging out twice, or with an already revoked session, is still a
    # successful logout from the browser's point of view.
    if refresh_token:
        try:
            await UserService().logout_user(refresh_token=refresh_token)
        except AppException:
            pass

    return {"message": "Logout successful"}
