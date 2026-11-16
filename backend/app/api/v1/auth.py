from fastapi import APIRouter, Cookie, Depends, Response
from fastapi.responses import JSONResponse

from app.core.cookies import (
    REFRESH_COOKIE,
    clear_access_cookie,
    clear_refresh_cookie,
    set_access_cookie,
    set_refresh_cookie,
)
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

# Both tokens are HttpOnly cookies (see app/core/cookies.py). The refresh
# cookie is scoped to these auth routes; the access cookie goes to the whole
# API. The access token is also returned in the body for API clients such as
# Swagger, but the web app never stores it.


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
    """Sign in. Sets both session cookies; the body carries only the access
    token, never the refresh token."""
    service = UserService()

    tokens = await service.login_user(
        email=login_data.email,
        password=login_data.password,
    )

    set_access_cookie(response, tokens["access_token"])
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
    """New access token from the refresh cookie.

    The refresh token is not rotated: the service hands back the same one,
    and re-setting it only renews the cookie's max-age. The JWT's own expiry,
    fixed at login, still ends the session.
    """
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
        clear_access_cookie(failure)
        clear_refresh_cookie(failure)
        return failure

    set_access_cookie(response, tokens["access_token"])
    set_refresh_cookie(response, tokens["refresh_token"])

    return AccessTokenResponse(access_token=tokens["access_token"])


@router.post(
    "/logout",
)
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
):
    """Revoke the session behind the refresh cookie and clear both cookies.
    Needs no access token, so an expired session can still log out."""
    clear_access_cookie(response)
    clear_refresh_cookie(response)

    # Logging out twice, or with an already revoked session, is still a
    # successful logout from the browser's point of view.
    if refresh_token:
        try:
            await UserService().logout_user(refresh_token=refresh_token)
        except AppException:
            pass

    return {"message": "Logout successful"}
