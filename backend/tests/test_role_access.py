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


def test_super_admin_holds_every_permission():
    """Checked for the enum and for the raw string a user document stores."""
    for permission in Permission:
        assert has_permission(UserRole.SUPER_ADMIN, permission), permission
        assert has_permission("super_admin", permission), permission


def test_super_admin_counts_as_hr_level():
    from app.core.roles import ADMIN_ROLES, HR_LEVEL_ROLES, MANAGED_ADMIN_ROLES

    assert "super_admin" in HR_LEVEL_ROLES
    assert "hr_admin" in HR_LEVEL_ROLES
    assert "manager" not in HR_LEVEL_ROLES
    assert {"super_admin", "hr_admin", "manager"} <= ADMIN_ROLES
    assert "employee" not in ADMIN_ROLES

    # The super admin manages HR and managers, never another super admin.
    assert MANAGED_ADMIN_ROLES == {"hr_admin", "manager"}


def test_super_admin_sees_whole_organisation():
    """Like HR, no manager_id filter is applied."""
    scope = EmployeeService._visibility_scope
    assert scope(_user("super_admin", "sa1")) == {}


def test_require_hr_admin_and_require_super_admin():
    """The super admin passes HR-only checks; HR does not pass super-admin-only
    ones."""
    from app.api.deps import require_hr_admin, require_super_admin

    def allowed(dependency, role):
        # Calls the dependency directly with a ready user, skipping the token
        # and session lookup in get_current_user.
        try:
            asyncio.run(dependency(current_user=_user(role, "u1")))
        except AppException as exc:
            assert exc.status_code == 403
            return False
        return True

    assert allowed(require_hr_admin, "super_admin")
    assert allowed(require_hr_admin, "hr_admin")
    assert not allowed(require_hr_admin, "manager")
    assert not allowed(require_hr_admin, "employee")

    assert allowed(require_super_admin, "super_admin")
    assert not allowed(require_super_admin, "hr_admin")
    assert not allowed(require_super_admin, "manager")
    assert not allowed(require_super_admin, "employee")


def test_super_admin_is_never_minted_an_employee_id():
    """An employee record would expose the super admin to HR's employee
    update path, so ensure_employee_profile must return it untouched."""
    from app.services.employee_identity import ensure_employee_profile

    class NoWritesCollection:
        """Any database call here would mean a mint was attempted."""

        def __getattr__(self, name):
            raise AssertionError(f"unexpected collection access: {name}")

    user = {"_id": "sa1", "role": "super_admin", "full_name": "Super Admin"}
    result = asyncio.run(ensure_employee_profile(NoWritesCollection(), user))

    assert result is user
    assert "employee_id" not in result


def test_admin_account_create_rejects_super_admin_role():
    """The schema's role Literal is what stops the super admin role (or a
    plain employee) being handed out through the Admin Accounts API."""
    from pydantic import ValidationError

    from app.schemas.user import AdminAccountCreate

    base = {
        "full_name": "New Person",
        "email": "new@example.com",
        "password": "Str0ng!Pass",
    }

    assert AdminAccountCreate(**base, role="hr_admin").role == "hr_admin"
    assert AdminAccountCreate(**base, role="manager").role == "manager"

    for role in ("super_admin", "employee"):
        try:
            AdminAccountCreate(**base, role=role)
        except ValidationError:
            pass
        else:
            raise AssertionError(f"{role} must not be creatable as an admin account")


if __name__ == "__main__":
    tests = [
        test_super_admin_holds_every_permission,
        test_super_admin_counts_as_hr_level,
        test_super_admin_sees_whole_organisation,
        test_require_hr_admin_and_require_super_admin,
        test_super_admin_is_never_minted_an_employee_id,
        test_admin_account_create_rejects_super_admin_role,
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

class _FakeAccounts:
    """Stands in for UserRepository and SessionService in delete tests."""

    def __init__(self, user, team_size=0):
        self.user = user
        self.team_size = team_size
        self.deleted = []
        self.revoked = []
        self.collection = self

    async def get_by_id(self, user_id):
        return self.user

    async def count_documents(self, query):
        return self.team_size

    async def delete(self, user_id):
        self.deleted.append(user_id)
        return True

    async def revoke_all_sessions_for_user(self, user_id):
        self.revoked.append(user_id)


def _account_service(fake):
    from app.services.user_service import UserService

    service = UserService.__new__(UserService)
    service.repository = fake
    service.session_service = fake
    return service


def _delete_status(service, user_id):
    try:
        asyncio.run(service.delete_admin_account(user_id))
    except AppException as exc:
        return exc.status_code
    return 200


def test_delete_admin_account_signs_out_and_deletes():
    fake = _FakeAccounts({"_id": "hr1", "role": "hr_admin", "full_name": "Asha"})

    assert _delete_status(_account_service(fake), "hr1") == 200
    assert fake.revoked == ["hr1"]
    assert fake.deleted == ["hr1"]


def test_delete_refuses_manager_with_a_team():
    """Deleting a manager would leave their employees reporting to nobody."""
    fake = _FakeAccounts(
        {"_id": "mgr1", "role": "manager", "full_name": "Ravi"},
        team_size=3,
    )

    assert _delete_status(_account_service(fake), "mgr1") == 409
    assert fake.deleted == []
    assert fake.revoked == []


def test_delete_cannot_touch_employees_or_the_super_admin():
    for role in ("employee", "super_admin"):
        fake = _FakeAccounts({"_id": "x1", "role": role, "full_name": "X"})

        assert _delete_status(_account_service(fake), "x1") == 404, role
        assert fake.deleted == [], role
