from enum import Enum


class UserRole(str, Enum):
    # Admin-level roles
    HR_ADMIN = "hr_admin"      # Admin • HR
    MANAGER = "manager"        # Admin • Manager

    # Regular employee
    EMPLOYEE = "employee"


class Permission(str, Enum):
    # Organization
    ORGANIZATION_READ = "organization.read"
    ORGANIZATION_UPDATE = "organization.update"

    DEPARTMENT_READ = "department.read"
    DEPARTMENT_CREATE = "department.create"
    DEPARTMENT_UPDATE = "department.update"
    DEPARTMENT_DELETE = "department.delete"

    # Users and roles
    USERS_READ = "users.read"
    USERS_CREATE = "users.create"
    USERS_UPDATE = "users.update"
    USERS_DELETE = "users.delete"

    ROLES_READ = "roles.read"
    ROLES_CREATE = "roles.create"
    ROLES_UPDATE = "roles.update"
    ROLES_DELETE = "roles.delete"

    # Employees
    EMPLOYEES_READ = "employees.read"
    EMPLOYEES_CREATE = "employees.create"
    EMPLOYEES_UPDATE = "employees.update"
    EMPLOYEES_DELETE = "employees.delete"

    # Attendance
    ATTENDANCE_READ = "attendance.read"
    ATTENDANCE_CREATE = "attendance.create"
    ATTENDANCE_UPDATE = "attendance.update"
    ATTENDANCE_APPROVE = "attendance.approve"

    # Leave
    LEAVE_READ = "leave.read"
    LEAVE_CREATE = "leave.create"
    LEAVE_UPDATE = "leave.update"
    LEAVE_APPROVE = "leave.approve"

    # Payroll
    PAYROLL_READ = "payroll.read"
    PAYROLL_CREATE = "payroll.create"
    PAYROLL_UPDATE = "payroll.update"
    PAYROLL_PROCESS = "payroll.process"
    PAYROLL_REPORTS = "payroll.reports"

    # Documents
    DOCUMENTS_READ = "documents.read"
    DOCUMENTS_CREATE = "documents.create"
    DOCUMENTS_UPDATE = "documents.update"
    DOCUMENTS_DELETE = "documents.delete"

    # Recruitment
    RECRUITMENT_READ = "recruitment.read"
    RECRUITMENT_CREATE = "recruitment.create"
    RECRUITMENT_UPDATE = "recruitment.update"
    RECRUITMENT_DELETE = "recruitment.delete"

    # Performance
    PERFORMANCE_READ = "performance.read"
    PERFORMANCE_CREATE = "performance.create"
    PERFORMANCE_UPDATE = "performance.update"
    PERFORMANCE_REVIEW = "performance.review"

    # Goals / Tasks
    GOALS_READ = "goals.read"
    GOALS_CREATE = "goals.create"
    GOALS_UPDATE = "goals.update"
    GOALS_APPROVE = "goals.approve"

    # Expenses
    EXPENSES_READ = "expenses.read"
    EXPENSES_CREATE = "expenses.create"
    EXPENSES_UPDATE = "expenses.update"
    EXPENSES_APPROVE = "expenses.approve"

    # Training
    TRAINING_READ = "training.read"
    TRAINING_CREATE = "training.create"
    TRAINING_UPDATE = "training.update"

    # Reports
    REPORTS_READ = "reports.read"
    REPORTS_CREATE = "reports.create"

    # Settings
    SETTINGS_READ = "settings.read"
    SETTINGS_UPDATE = "settings.update"

    # Own profile
    SELF_PROFILE_READ = "self_profile.read"
    SELF_PROFILE_UPDATE = "self_profile.update"

    # Payslips
    PAYSLIPS_READ = "payslips.read"


# Full admin access - HR and Manager both act as admins.
ADMIN_PERMISSIONS = set(Permission)

EMPLOYEE_PERMISSIONS = {
    # Attendance
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CREATE,

    # Leave
    Permission.LEAVE_READ,
    Permission.LEAVE_CREATE,
    Permission.LEAVE_UPDATE,

    # Documents
    Permission.DOCUMENTS_READ,

    # Expenses
    Permission.EXPENSES_READ,
    Permission.EXPENSES_CREATE,
    Permission.EXPENSES_UPDATE,

    # Training
    Permission.TRAINING_READ,

    # Performance
    Permission.PERFORMANCE_READ,

    # Payslips
    Permission.PAYSLIPS_READ,

    # Own Profile
    Permission.SELF_PROFILE_READ,
    Permission.SELF_PROFILE_UPDATE,
}


ROLE_PERMISSIONS: dict[UserRole, set[Permission]] = {
    UserRole.HR_ADMIN: ADMIN_PERMISSIONS,
    UserRole.MANAGER: ADMIN_PERMISSIONS,
    UserRole.EMPLOYEE: EMPLOYEE_PERMISSIONS,
}


def has_permission(
    role: UserRole,
    permission: Permission,
) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())


def get_role_permissions(role: UserRole) -> set[Permission]:
    return ROLE_PERMISSIONS.get(role, set())
