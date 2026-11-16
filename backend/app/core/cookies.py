"""Session cookies.

Both JWTs live in HttpOnly cookies, so page scripts can never read them:

- ``hrms_access_token`` is sent with every API request and lives as long as
  the access token itself.
- ``hrms_refresh_token`` is scoped to the auth routes; only refresh and
  logout need it.

Local http development needs Secure off. When the frontend and the API are
on different sites in production, set COOKIE_SECURE=true and
COOKIE_SAMESITE=none or the browser drops them.
"""
from fastapi import Response

from app.core.config import settings

ACCESS_COOKIE = "hrms_access_token"
# Every API route sits under /api/v1, so the access cookie reaches all of them.
ACCESS_COOKIE_PATH = "/api/v1"

REFRESH_COOKIE = "hrms_refresh_token"
# Narrow path: the long-lived refresh token stays off every other request.
REFRESH_COOKIE_PATH = "/api/v1/auth"

# Cookie-authenticated requests that change state must carry this header.
# A cross-site form cannot set it, and a cross-site fetch that sets it needs
# a CORS preflight, which only the allowed origins pass.
CSRF_HEADER = "X-Requested-With"


def _set(response: Response, key: str, value: str, max_age: int, path: str) -> None:
    """Set a session cookie: always HttpOnly, Secure and SameSite from settings."""
    response.set_cookie(
        key=key,
        value=value,
        max_age=max_age,
        path=path,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE.lower(),
    )


def _clear(response: Response, key: str, path: str) -> None:
    """Expire a session cookie. The attributes mirror _set: a browser only
    replaces a cookie with the same name and path, and rejects SameSite=None
    without Secure."""
    response.delete_cookie(
        key=key,
        path=path,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE.lower(),
    )


def set_access_cookie(response: Response, access_token: str) -> None:
    _set(
        response,
        ACCESS_COOKIE,
        access_token,
        settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ACCESS_COOKIE_PATH,
    )


def clear_access_cookie(response: Response) -> None:
    _clear(response, ACCESS_COOKIE, ACCESS_COOKIE_PATH)


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    _set(
        response,
        REFRESH_COOKIE,
        refresh_token,
        settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        REFRESH_COOKIE_PATH,
    )


def clear_refresh_cookie(response: Response) -> None:
    _clear(response, REFRESH_COOKIE, REFRESH_COOKIE_PATH)
