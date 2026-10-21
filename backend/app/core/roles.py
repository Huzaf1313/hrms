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

    # Shifts
    SHIFT_READ = "shift.read"
    SHIFT_CREATE = "shift.create"
    SHIFT_UPDATE = "shift.update"
    SHIFT_DELETE = "shift.delete"

    # Holidays
    HOLIDAY_READ = "holiday.read"
    HOLIDAY_CREATE = "holiday.create"
    HOLIDAY_UPDATE = "holiday.update"
    HOLIDAY_DELETE = "holiday.delete"

    # Leave
    LEAVE_READ = "leave.read"
    LEAVE_CREATE = "leave.create"
    LEAVE_UPDATE = "leave.update"
    LEAVE_APPROVE = "leave.approve"

    # Payroll
    PAYROLL_READ = "payroll.read"
    PAYROLL_CREATE = "payroll.create"
    PAYROLL_UPDATE = "payroll.update"
    PAYROLL_MANAGE = "payroll.manage"
    PAYROLL_PROCESS = "payroll.process"
    PAYROLL_REPORTS = "payroll.reports"

    SALARY_STRUCTURE_READ = "salary_structure.read"

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

    # Assets
    ASSETS_READ = "assets.read"
    ASSETS_CREATE = "assets.create"
    ASSETS_UPDATE = "assets.update"
    ASSETS_DELETE = "assets.delete"

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

    # Announcements
    ANNOUNCEMENT_READ = "announcement.read"
    ANNOUNCEMENT_MANAGE = "announcement.manage"

    # Exit / offboarding requests
    EXIT_REQUESTS_READ = "exit_requests.read"
    EXIT_REQUESTS_MANAGE = "exit_requests.manage"

    # Own profile
    SELF_PROFILE_READ = "self_profile.read"
    SELF_PROFILE_UPDATE = "self_profile.update"

    # Payslips
    PAYSLIPS_READ = "payslips.read"


# HR sees and does everything.
ADMIN_PERMISSIONS = set(Permission)

# Managers run a team day to day. Hiring, payroll and payslips stay with HR:
# they are organisation-wide, carry compensation data, and are not
# team-scoped - a manager has no business seeing another team's pay.
HR_ONLY_PERMISSIONS = {
    # Recruitment
    Permission.RECRUITMENT_READ,
    Permission.RECRUITMENT_CREATE,
    Permission.RECRUITMENT_UPDATE,
    Permission.RECRUITMENT_DELETE,

    # Payroll
    Permission.PAYROLL_READ,
    Permission.PAYROLL_CREATE,
    Permission.PAYROLL_UPDATE,
    Permission.PAYROLL_MANAGE,
    Permission.PAYROLL_PROCESS,
    Permission.PAYROLL_REPORTS,

    # Payslips
    Permission.PAYSLIPS_READ,
}

# Deliberately NOT in HR_ONLY_PERMISSIONS: salary structures are a config
# lookup (like departments and shifts) that the employee form reads to render
# a salary band. Only the writes - PAYROLL_MANAGE - stay with HR.
MANAGER_PERMISSIONS = ADMIN_PERMISSIONS - HR_ONLY_PERMISSIONS

EMPLOYEE_PERMISSIONS = {
    # Attendance
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CREATE,

    # Shifts (own shift only - routes scope this down to the caller)
    Permission.SHIFT_READ,

    # Holidays (read-only - the employee attendance calendar marks them)
    Permission.HOLIDAY_READ,

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
    UserRole.MANAGER: MANAGER_PERMISSIONS,
    UserRole.EMPLOYEE: EMPLOYEE_PERMISSIONS,
}


def has_permission(
    role: UserRole,
    permission: Permission,
) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())


def get_role_permissions(role: UserRole) -> set[Permission]:
    return ROLE_PERMISSIONS.get(role, set())
