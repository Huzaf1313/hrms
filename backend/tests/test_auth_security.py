
"""Unit tests for login lockout behavior.

Run from the backend directory:
    python -m tests.test_auth_security

No database or external test framework required.
"""
import asyncio
from unittest.mock import patch

from app.core.exceptions import AppException
from app.services.user_service import UserService

import jwt
from fastapi.security import HTTPAuthorizationCredentials

from app.api import deps
from app.core.jwt import create_access_token

TEST_USER_ID = "507f1f77bcf86cd799439011"

class FakeUserRepository:
    def __init__(self, failed_attempts=0, is_locked=False):
        self.user = {
            "_id": TEST_USER_ID,
            "email": "security-test@example.com",
            "password_hash": "fake-password-hash",
            "role": "employee",
            "is_active": True,
            "is_locked": is_locked,
            "failed_login_attempts": failed_attempts,
        }

    async def get_by_email(self, email):
        if email != self.user["email"]:
            return None
        return dict(self.user)

    async def increment_failed_login_attempts(self, user_id):
        if not self.user["is_locked"]:
            self.user["failed_login_attempts"] += 1
        return dict(self.user)

    async def update(self, user_id, update_data):
        self.user.update(update_data)
        return dict(self.user)

class FakeSessionService:
    async def create_session(self, user_id, refresh_token):
        return None

def make_service(repository):
    service = UserService.__new__(UserService)
    service.repository = repository
    service.session_service = FakeSessionService()
    return service

def expect_app_exception(coroutine, expected_status):
    try:
        asyncio.run(coroutine)
    except AppException as exc:
        assert exc.status_code == expected_status, (
            f"Expected status {expected_status}, got {exc.status_code}"
        )
    else:
        raise AssertionError("Expected AppException, but no exception was raised")

def test_failed_login_increments_counter():
    repository = FakeUserRepository()
    service = make_service(repository)

    with patch(
        "app.services.user_service.verify_password",
        return_value=False,
    ):
        expect_app_exception(
            service.login_user("security-test@example.com", "wrong-password"),
            401,
        )

    assert repository.user["failed_login_attempts"] == 1
    assert repository.user["is_locked"] is False

def test_five_failed_logins_lock_account():
    repository = FakeUserRepository()
    service = make_service(repository)

    with patch(
        "app.services.user_service.verify_password",
        return_value=False,
    ):
        for attempt in range(5):
            expect_app_exception(
                service.login_user(
                    "security-test@example.com",
                    "wrong-password",
                ),
                401,
            )

            if attempt < 4:
                assert repository.user["is_locked"] is False

    assert repository.user["failed_login_attempts"] == 5
    assert repository.user["is_locked"] is True

def test_successful_login_resets_failed_counter():
    from unittest.mock import AsyncMock

    repository = FakeUserRepository(failed_attempts=3)
    service = make_service(repository)

    service.session_service.create_session = AsyncMock(
        return_value={"_id": "507f1f77bcf86cd799439011"}
    )

    with (
        patch(
            "app.services.user_service.verify_password",
            return_value=True,
        ),
        patch(
            "app.services.user_service.create_access_token",
            return_value="test-access-token",
        ),
        patch(
            "app.services.user_service.create_refresh_token",
            return_value="test-refresh-token",
        ),
    ):
        result = asyncio.run(
            service.login_user(
                "security-test@example.com",
                "correct-test-password",
            )
        )

    assert result["access_token"] == "test-access-token"
    assert result["refresh_token"] == "test-refresh-token"
    assert repository.user["failed_login_attempts"] == 0

def test_locked_account_is_rejected():
    repository = FakeUserRepository(is_locked=True)
    service = make_service(repository)

    with patch(
        "app.services.user_service.verify_password",
        return_value=True,
    ):
        expect_app_exception(
            service.login_user(
                "security-test@example.com",
                "correct-test-password",
            ),
            403,
        )

def test_inactive_account_is_rejected_by_auth_dependency():
    from unittest.mock import AsyncMock
    from fastapi.security import HTTPAuthorizationCredentials
    from app.api.deps import get_current_user

    user = {
        "_id": TEST_USER_ID,
        "role": "employee",
        "is_active": False,
        "is_locked": False,
    }
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="fake-test-token",
    )

    with (
        patch(
            "app.api.deps.decode_token",
            return_value={
                "sub": TEST_USER_ID,
                "type": "access",
                "session_id": "507f1f77bcf86cd799439011",
            },
        ),
        patch(
            "app.api.deps.user_repository.get_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
        patch(
            "app.api.deps.session_repository.get_by_id",
            new_callable=AsyncMock,
            return_value={
                "_id": "507f1f77bcf86cd799439011",
                "user_id": TEST_USER_ID,
                "is_active": True,
            },
        ),
    ):
        expect_app_exception(
            get_current_user(credentials),
            403,
        )

def test_locked_account_is_rejected_by_auth_dependency():
    from unittest.mock import AsyncMock
    from fastapi.security import HTTPAuthorizationCredentials
    from app.api.deps import get_current_user

    user = {
        "_id": TEST_USER_ID,
        "role": "employee",
        "is_active": True,
        "is_locked": True,
    }
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="fake-test-token",
    )

    with (
        patch(
            "app.api.deps.decode_token",
            return_value={
                "sub": TEST_USER_ID,
                "type": "access",
                "session_id": "507f1f77bcf86cd799439011",
            },
        ),
        patch(
            "app.api.deps.user_repository.get_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
        patch(
            "app.api.deps.session_repository.get_by_id",
            new_callable=AsyncMock,
            return_value={
                "_id": "507f1f77bcf86cd799439011",
                "user_id": TEST_USER_ID,
                "is_active": True,
            },
        ),
    ):
        expect_app_exception(
            get_current_user(credentials),
            403,
        )

if __name__ == "__main__":
    tests = [
        test_failed_login_increments_counter,
        test_five_failed_logins_lock_account,
        test_successful_login_resets_failed_counter,
        test_locked_account_is_rejected,
        test_inactive_account_is_rejected_by_auth_dependency,
        test_locked_account_is_rejected_by_auth_dependency,
    ]

    for test in tests:
        test()
        print(f"ok  {test.__name__}")

    print(f"\n{len(tests)} login security checks passed")

def test_locked_account_is_rejected_by_auth_dependency():
    from unittest.mock import AsyncMock

    from app.api.deps import get_current_user

    user = {
        "_id": TEST_USER_ID,
        "role": "employee",
        "is_active": True,
        "is_locked": True,
    }
    credentials = HTTPAuthorizationCredentials(
        scheme="Bearer",
        credentials="fake-test-token",
    )

    with (
        patch(
            "app.api.deps.decode_token",
            return_value={"sub": TEST_USER_ID, "type": "access"},
        ),
        patch(
            "app.api.deps.user_repository.get_by_id",
            new_callable=AsyncMock,
            return_value=user,
        ),
    ):
        expect_app_exception(
            get_current_user(credentials),
            403,
        )