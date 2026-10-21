"""Which employees an authenticated caller is allowed to see.

HR sees the whole organisation. A manager sees only the employees assigned to
them. Employees are reached through their own routes, not this.

Every admin service that reads employee records funnels through
`visibility_scope` so the rule stays in one place - three services each
carrying their own copy is how the three drift apart.
"""
from app.core.exceptions import AppException
from app.core.roles import UserRole


def visibility_scope(current_user: dict | None) -> dict:
    """Query filter to merge into an employee lookup for `current_user`.

    Empty dict means unrestricted (HR). Returns a failing exception rather
    than an open scope when a manager account has no resolvable id, so a
    broken account fails closed.
    """
    if not current_user:
        return {}

    role = getattr(current_user.get("role"), "value", current_user.get("role"))

    if role != UserRole.MANAGER.value:
        return {}

    user_id = current_user.get("_id")

    if user_id is None:
        raise AppException(
            "Authenticated manager account has no valid user ID",
            403,
        )

    return {"manager_id": str(user_id)}


def scope_matches(employee: dict | None, scope: dict) -> bool:
    """True when `employee` satisfies `scope` (an empty scope allows all)."""
    if not scope:
        return True

    if employee is None:
        return False

    manager_id = employee.get("manager_id")

    return manager_id is not None and str(manager_id) == scope.get("manager_id")


async def visible_employee_codes(
    employee_repository,
    current_user: dict | None,
) -> list[str] | None:
    """Business codes (EMP001) of the employees `current_user` may see.

    Returns None for HR, meaning "no restriction". Collections that reference
    employees by business code rather than by document id - assets and asset
    requests - filter on this instead of on manager_id directly.
    """
    scope = visibility_scope(current_user)

    if not scope:
        return None

    employees = await employee_repository.get_all(
        skip=0,
        limit=10000,
        scope=scope,
    )

    return [
        employee["employee_id"]
        for employee in employees
        if employee.get("employee_id")
    ]