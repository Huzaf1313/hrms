"""Who may list and review attendance regularization requests.

Managers review their own team only, nobody reviews their own request, and
a manager's list is limited to their team plus themselves.
"""
import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.api.v1 import employee_attendance_regularization as api
from app.core.exceptions import AppException
from app.services.employee_attendance_regularization_service import (
    EmployeeAttendanceRegularizationService,
)

# Callers: a manager (user id m1, employee code AAR008) and an HR admin.
MANAGER = {"_id": "m1", "role": "manager", "employee_id": "AAR008"}
HR = {"_id": "h1", "role": "hr_admin", "employee_id": "AAR003"}

# Stand-in employee directory keyed by business code. AAR002 is on m1's
# team, AAR004 on someone else's; AAR008 and AAR003 are the callers.
EMPLOYEES = {
    "AAR002": {"employee_id": "AAR002", "manager_id": "m1"},
    "AAR004": {"employee_id": "AAR004", "manager_id": "other"},
    "AAR008": {"employee_id": "AAR008", "manager_id": None},
    "AAR003": {"employee_id": "AAR003", "manager_id": None},
}


def review(user, requester_code):
    """Run the review route as `user` on a request filed by `requester_code`.

    Returns how many times the service review ran (1 = allowed). A refused
    review raises AppException before the service is reached.
    """
    service = SimpleNamespace(
        get_request=AsyncMock(return_value={"employee_id": requester_code}),
        review_request=AsyncMock(return_value={"reviewed": True}),
    )
    repository = SimpleNamespace(
        get_by_employee_id=AsyncMock(side_effect=EMPLOYEES.get),
    )

    with (
        patch.object(api, "service", service),
        patch.object(api, "employee_repository", repository),
        patch.object(api, "invalidate_attendance_regularization_cache", AsyncMock()),
        patch.object(api, "invalidate_attendance_cache", AsyncMock()),
        patch.object(api, "serialize_regularization", AsyncMock(return_value=None)),
        patch.object(api, "APIResponse", lambda **kwargs: kwargs),
    ):
        asyncio.run(
            api.review_regularization_request(
                "r1",
                SimpleNamespace(status="Approved", comment=None),
                current_user=user,
            )
        )

    return service.review_request.await_count


def test_review_request_is_a_service_method():
    # review_request was once a module-level function by mistake, so
    # service.review_request did not exist and every review failed.
    assert hasattr(EmployeeAttendanceRegularizationService, "review_request")


def test_manager_reviews_own_team():
    assert review(MANAGER, "AAR002") == 1


def test_manager_cannot_review_another_team():
    with pytest.raises(AppException):
        review(MANAGER, "AAR004")


def test_nobody_reviews_their_own_request():
    with pytest.raises(AppException):
        review(MANAGER, "AAR008")

    with pytest.raises(AppException):
        review(HR, "AAR003")


def test_hr_reviews_a_manager_request():
    assert review(HR, "AAR008") == 1


def listed_employee_ids(user):
    """Run the list route as `user` and return the employee_ids filter it
    passed to the service (None means unrestricted). The cache is stubbed
    out so the route always reaches the service."""
    service = SimpleNamespace(get_all_requests=AsyncMock(return_value=[]))
    # visible_employee_codes reads the manager's team from get_all.
    repository = SimpleNamespace(
        get_all=AsyncMock(return_value=[EMPLOYEES["AAR002"]]),
    )

    with (
        patch.object(api, "service", service),
        patch.object(api, "employee_repository", repository),
        patch.object(api, "get_cache", AsyncMock(return_value=None)),
        patch.object(api, "set_cache", AsyncMock()),
    ):
        asyncio.run(
            api.get_regularization_requests(
                status=None, page=1, limit=100, current_user=user
            )
        )

    return service.get_all_requests.await_args.kwargs["employee_ids"]


def test_manager_list_is_team_plus_self():
    assert listed_employee_ids(MANAGER) == ["AAR002", "AAR008"]


def test_hr_list_is_unrestricted():
    assert listed_employee_ids(HR) is None
