"""Both JWTs travel as HttpOnly cookies; the refresh token never in a body."""
from unittest.mock import AsyncMock, patch

import asyncio

import httpx
from fastapi import FastAPI

from app.api.v1 import auth
from app.core.exceptions import AppException
from app.main import app_exception_handler

# What the mocked UserService login / refresh calls return.
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

    cookies = response.headers.get_list("set-cookie")
    refresh = next(c for c in cookies if c.startswith("hrms_refresh_token="))
    access = next(c for c in cookies if c.startswith("hrms_access_token="))

    assert "hrms_refresh_token=refresh-1" in refresh
    assert "HttpOnly" in refresh
    assert "Path=/api/v1/auth" in refresh

    assert "hrms_access_token=access-1" in access
    assert "HttpOnly" in access
    assert "Path=/api/v1" in access


def test_refresh_reads_the_cookie():
    refresh = AsyncMock(return_value=TOKENS)

    with patch.object(auth.UserService, "refresh_access_token", refresh):
        response = post("/refresh", cookie="refresh-1")

    assert response.status_code == 200
    assert response.json()["access_token"] == "access-1"
    assert "refresh_token" not in response.json()
    assert refresh.await_args.kwargs == {"refresh_token": "refresh-1"}
    assert "hrms_access_token=access-1" in response.headers["set-cookie"]


def test_refresh_without_cookie_is_401():
    assert post("/refresh").status_code == 401


def test_refresh_with_dead_session_clears_the_cookie():
    refresh = AsyncMock(side_effect=AppException("Session has been revoked", 401))

    with patch.object(auth.UserService, "refresh_access_token", refresh):
        response = post("/refresh", cookie="stale")

    assert response.status_code == 401
    assert response.json()["message"] == "Session has been revoked"
    # delete_cookie writes an empty value with Max-Age=0.
    assert 'hrms_refresh_token=""' in response.headers["set-cookie"]
    assert 'hrms_access_token=""' in response.headers["set-cookie"]


def test_logout_revokes_and_clears_even_when_already_revoked():
    logout = AsyncMock(side_effect=AppException("Invalid or already revoked session", 401))

    with patch.object(auth.UserService, "logout_user", logout):
        response = post("/logout", cookie="refresh-1")

    assert response.status_code == 200
    assert logout.await_args.kwargs == {"refresh_token": "refresh-1"}
    assert 'hrms_refresh_token=""' in response.headers["set-cookie"]
    assert 'hrms_access_token=""' in response.headers["set-cookie"]

    # No cookie at all is still a successful logout.
    assert post("/logout").status_code == 200


def call_protected(method: str, headers: dict | None = None, cookie: str | None = None):
    """Hit a route guarded by access_credentials, returning the token it saw."""
    from fastapi import Depends
    from fastapi.security import HTTPAuthorizationCredentials

    from app.api.deps import access_credentials

    app = FastAPI()
    app.add_exception_handler(AppException, app_exception_handler)

    @app.api_route("/api/v1/thing", methods=["GET", "POST"])
    async def thing(credentials: HTTPAuthorizationCredentials = Depends(access_credentials)):
        return {"token": credentials.credentials}

    async def send():
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
            cookies={"hrms_access_token": cookie} if cookie else None,
        ) as http:
            return await http.request(method, "/api/v1/thing", headers=headers)

    return asyncio.run(send())


def test_access_token_is_read_from_the_cookie():
    response = call_protected("GET", cookie="access-1")

    assert response.status_code == 200
    assert response.json() == {"token": "access-1"}


def test_bearer_header_wins_over_the_cookie():
    # A POST with no CSRF header: header tokens are exempt from that check.
    response = call_protected(
        "POST", headers={"Authorization": "Bearer header-1"}, cookie="access-1"
    )

    assert response.status_code == 200
    assert response.json() == {"token": "header-1"}


def test_no_token_is_401():
    assert call_protected("GET").status_code == 401


def test_cookie_write_without_csrf_header_is_rejected():
    assert call_protected("POST", cookie="access-1").status_code == 403

    # Only the header's presence is checked; any value passes.
    response = call_protected(
        "POST", headers={"X-Requested-With": "fetch"}, cookie="access-1"
    )
    assert response.status_code == 200
