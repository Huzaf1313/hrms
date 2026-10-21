"""Checks the role/permission model and the manager visibility scope.

Run with: python -m tests.test_role_access
No database or test framework required.
"""
import asyncio

from app.core.exceptions import AppException
from app.core.roles import Permission, UserRole, has_permission
from app.core.scope import scope_matches, visible_employee_codes
from app.services.employee_service import EmployeeService


def _user(role: str, user_id: str) -> dict:
    return {"role": role, "_id": user_id, "email": f"{role}@example.com"}


def test_manager_cannot_reach_hr_only_permissions():
    hr_only = {
        Permission.RECRUITMENT_READ,
        Permission.RECRUITMENT_CREATE,
        Permission.RECRUITMENT_UPDATE,
        Permission.RECRUITMENT_DELETE,
        Permission.PAYROLL_READ,
        Permission.PAYROLL_MANAGE,
        Permission.PAYROLL_PROCESS,
        Permission.PAYROLL_REPORTS,
        Permission.PAYSLIPS_READ,
    }

    for permission in hr_only:
        assert not has_permission(UserRole.MANAGER, permission), permission
        assert has_permission(UserRole.HR_ADMIN, permission), permission


def test_roles_come_from_mongo_as_plain_strings():
    """deps.py passes the raw `role` string off the user document, not the
    enum, so the lookup has to work for both."""
    assert not has_permission("manager", Permission.RECRUITMENT_READ)
    assert not has_permission("manager", Permission.PAYROLL_MANAGE)
    assert has_permission("manager", Permission.EMPLOYEES_READ)
    assert has_permission("hr_admin", Permission.RECRUITMENT_READ)
    assert has_permission("employee", Permission.SELF_PROFILE_UPDATE)
    assert not has_permission("employee", Permission.EMPLOYEES_READ)


def test_manager_keeps_team_permissions():
    for permission in (
        Permission.EMPLOYEES_READ,
        Permission.EMPLOYEES_UPDATE,
        Permission.ATTENDANCE_APPROVE,
        Permission.LEAVE_APPROVE,
        Permission.ASSETS_READ,
    ):
        assert has_permission(UserRole.MANAGER, permission), permission


def test_employee_permissions_unchanged():
    assert has_permission(UserRole.EMPLOYEE, Permission.SELF_PROFILE_UPDATE)
    assert has_permission(UserRole.EMPLOYEE, Permission.PAYSLIPS_READ)
    assert not has_permission(UserRole.EMPLOYEE, Permission.EMPLOYEES_READ)
    assert not has_permission(UserRole.EMPLOYEE, Permission.RECRUITMENT_READ)


def test_visibility_scope():
    scope = EmployeeService._visibility_scope

    # HR sees the whole organisation.
    assert scope(_user("hr_admin", "hr1")) == {}

    # A manager sees only what is assigned to them.
    assert scope(_user("manager", "mgr1")) == {"manager_id": "mgr1"}
    assert scope(_user("manager", "mgr2")) == {"manager_id": "mgr2"}

    # An authenticated manager account with no id must fail closed, not open.
    try:
        scope({"role": "manager"})
    except AppException as exc:
        assert exc.status_code == 403
    else:
        raise AssertionError("manager without _id should be rejected")


def test_visible_employee_codes_narrows_for_managers():
    """Assets and asset requests join on the employee business code, so they
    need the narrowed list rather than a manager_id filter of their own."""

    class FakeEmployees:
        def __init__(self, rows):
            self.rows = rows
            self.seen_scope = None

        async def get_all(self, filters=None, skip=0, limit=10, scope=None):
            self.seen_scope = scope
            return [
                e for e in self.rows
                if not scope or str(e.get("manager_id")) == scope["manager_id"]
            ]

    rows = [
        {"employee_id": "EMP001", "manager_id": "mgr1"},
        {"employee_id": "EMP002", "manager_id": "mgr2"},
        {"employee_id": "EMP003", "manager_id": "mgr1"},
    ]
    repo = FakeEmployees(rows)

    # HR is unrestricted -> None, which every caller reads as "no filter".
    assert asyncio.run(visible_employee_codes(repo, _user("hr_admin", "hr1"))) is None

    mgr = asyncio.run(visible_employee_codes(repo, _user("manager", "mgr1")))
    assert mgr == ["EMP001", "EMP003"]

    other = asyncio.run(visible_employee_codes(repo, _user("manager", "mgr2")))
    assert other == ["EMP002"]


def test_resolve_manager_rejects_non_admin_account():
    """A manager_id pointing at an employee record must not be accepted."""

    class FakeUsers:
        async def get_by_id(self, user_id):
            return {"_id": user_id, "role": "employee", "full_name": "Someone"}

    service = EmployeeService.__new__(EmployeeService)
    service.user_repository = FakeUsers()

    data = {"manager_id": "emp1"}

    try:
        asyncio.run(service._resolve_manager(data))
    except AppException as exc:
        assert exc.status_code == 400
        assert "HR or manager" in exc.message
    else:
        raise AssertionError("an employee record must not be assignable as manager")


if __name__ == "__main__":
    tests = [
        test_manager_cannot_reach_hr_only_permissions,
        test_roles_come_from_mongo_as_plain_strings,
        test_manager_keeps_team_permissions,
        test_employee_permissions_unchanged,
        test_visibility_scope,
        test_visible_employee_codes_narrows_for_managers,
        test_resolve_manager_rejects_non_admin_account,
    ]

    for test in tests:
        test()
        print(f"ok  {test.__name__}")

    print(f"\n{len(tests)} checks passed")