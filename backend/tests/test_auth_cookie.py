"""The refresh token travels only as an HttpOnly cookie, never in a body."""
from unittest.mock import AsyncMock, patch

import asyncio

import httpx
from fastapi import FastAPI

from app.api.v1 import auth
from app.core.exceptions import AppException
from app.main import app_exception_handler

TOKENS = {"access_token": "access-1", "refresh_token": "refresh-1", "token_type": "bearer"}


def post(path: str, cookie: str | None = None, json: dict | None = None):
    """POST to the auth router in-process, optionally with the refresh cookie."""
    app = FastAPI()
    app.add_exception_handler(AppException, app_exception_handler)
    app.include_router(auth.router, prefix="/api/v1")

    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            cookies={"hrms_refresh_token": cookie} if cookie else None,
        ) as http:
            return await http.post(f"/api/v1/auth{path}", json=json)

    return asyncio.run(send())


def test_login_sets_httponly_cookie_and_hides_refresh_token():
    with patch.object(auth.UserService, "login_user", AsyncMock(return_value=TOKENS)):
        response = post("/login", json={"email": "a@b.co", "password": "Passw0rd!"})

    assert response.status_code == 200
    assert response.json() == {"access_token": "access-1", "token_type": "bearer"}

    cookie = response.headers["set-cookie"]
    assert "hrms_refresh_token=refresh-1" in cookie
    assert "HttpOnly" in cookie
    assert "Path=/api/v1/auth" in cookie


def test_refresh_reads_the_cookie():
    refresh = AsyncMock(return_value=TOKENS)

    with patch.object(auth.UserService, "refresh_access_token", refresh):
        response = post("/refresh", cookie="refresh-1")

    assert response.status_code == 200
    assert response.json()["access_token"] == "access-1"
    assert "refresh_token" not in response.json()
    assert refresh.await_args.kwargs == {"refresh_token": "refresh-1"}


def test_refresh_without_cookie_is_401():
    assert post("/refresh").status_code == 401


def test_refresh_with_dead_session_clears_the_cookie():
    refresh = AsyncMock(side_effect=AppException("Session has been revoked", 401))

    with patch.object(auth.UserService, "refresh_access_token", refresh):
        response = post("/refresh", cookie="stale")

    assert response.status_code == 401
    assert response.json()["message"] == "Session has been revoked"
    assert 'hrms_refresh_token=""' in response.headers["set-cookie"]


def test_logout_revokes_and_clears_even_when_already_revoked():
    logout = AsyncMock(side_effect=AppException("Invalid or already revoked session", 401))

    with patch.object(auth.UserService, "logout_user", logout):
        response = post("/logout", cookie="refresh-1")

    assert response.status_code == 200
    assert logout.await_args.kwargs == {"refresh_token": "refresh-1"}
    assert 'hrms_refresh_token=""' in response.headers["set-cookie"]

    assert post("/logout").status_code == 200
