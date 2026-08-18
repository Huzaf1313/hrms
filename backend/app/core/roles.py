from enum import Enum


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    HR_ADMIN = "hr_admin"
    HR_EXECUTIVE = "hr_executive"
    MANAGER = "manager"
    TEAM_LEAD = "team_lead"
    EMPLOYEE = "employee"
    RECRUITER = "recruiter"
    PAYROLL_ADMIN = "payroll_admin"


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


ROLE_PERMISSIONS: dict[UserRole, set[Permission]] = {
    # ============================================================
    # SUPER ADMIN
    # ============================================================
    UserRole.SUPER_ADMIN: set(Permission),

    # ============================================================
    # HR ADMIN
    # ============================================================
    UserRole.HR_ADMIN: {
        # Users
        Permission.USERS_READ,
        Permission.USERS_CREATE,
        Permission.USERS_UPDATE,

        # Departments
        Permission.DEPARTMENT_READ,
        Permission.DEPARTMENT_CREATE,
        Permission.DEPARTMENT_UPDATE,
        Permission.DEPARTMENT_DELETE,

        # Employees
        Permission.EMPLOYEES_READ,
        Permission.EMPLOYEES_CREATE,
        Permission.EMPLOYEES_UPDATE,
        Permission.EMPLOYEES_DELETE,

        # Attendance
        Permission.ATTENDANCE_READ,
        Permission.ATTENDANCE_CREATE,
        Permission.ATTENDANCE_UPDATE,
        Permission.ATTENDANCE_APPROVE,

        # Leave
        Permission.LEAVE_READ,
        Permission.LEAVE_CREATE,
        Permission.LEAVE_UPDATE,
        Permission.LEAVE_APPROVE,

        # Payroll
        Permission.PAYROLL_READ,
        Permission.PAYROLL_CREATE,
        Permission.PAYROLL_UPDATE,
        Permission.PAYROLL_PROCESS,
        Permission.PAYROLL_REPORTS,

        # Documents
        Permission.DOCUMENTS_READ,
        Permission.DOCUMENTS_CREATE,
        Permission.DOCUMENTS_UPDATE,
        Permission.DOCUMENTS_DELETE,

        # Recruitment
        Permission.RECRUITMENT_READ,
        Permission.RECRUITMENT_CREATE,
        Permission.RECRUITMENT_UPDATE,
        Permission.RECRUITMENT_DELETE,

        # Performance
        Permission.PERFORMANCE_READ,
        Permission.PERFORMANCE_CREATE,
        Permission.PERFORMANCE_UPDATE,
        Permission.PERFORMANCE_REVIEW,

        # Goals
        Permission.GOALS_READ,
        Permission.GOALS_CREATE,
        Permission.GOALS_UPDATE,
        Permission.GOALS_APPROVE,

        # Expenses
        Permission.EXPENSES_READ,
        Permission.EXPENSES_CREATE,
        Permission.EXPENSES_UPDATE,
        Permission.EXPENSES_APPROVE,

        # Training
        Permission.TRAINING_READ,
        Permission.TRAINING_CREATE,
        Permission.TRAINING_UPDATE,

        # Reports
        Permission.REPORTS_READ,
        Permission.REPORTS_CREATE,

        # Settings
        Permission.SETTINGS_READ,
    },

    # ============================================================
    # HR EXECUTIVE
    # ============================================================
    UserRole.HR_EXECUTIVE: {
        # Users
        Permission.USERS_READ,

        # Departments
        Permission.DEPARTMENT_READ,

        # Employees
        Permission.EMPLOYEES_READ,
        Permission.EMPLOYEES_CREATE,
        Permission.EMPLOYEES_UPDATE,

        # Attendance
        Permission.ATTENDANCE_READ,
        Permission.ATTENDANCE_CREATE,
        Permission.ATTENDANCE_UPDATE,

        # Leave
        Permission.LEAVE_READ,
        Permission.LEAVE_CREATE,
        Permission.LEAVE_UPDATE,

        # Documents
        Permission.DOCUMENTS_READ,
        Permission.DOCUMENTS_CREATE,
        Permission.DOCUMENTS_UPDATE,

        # Recruitment
        Permission.RECRUITMENT_READ,
        Permission.RECRUITMENT_CREATE,
        Permission.RECRUITMENT_UPDATE,

        # Performance
        Permission.PERFORMANCE_READ,
        Permission.PERFORMANCE_CREATE,
        Permission.PERFORMANCE_UPDATE,

        # Training
        Permission.TRAINING_READ,
        Permission.TRAINING_CREATE,
        Permission.TRAINING_UPDATE,

        # Expenses
        Permission.EXPENSES_READ,
        Permission.EXPENSES_CREATE,
        Permission.EXPENSES_UPDATE,

        # Reports
        Permission.REPORTS_READ,
    },

    # ============================================================
    # MANAGER
    # ============================================================
    UserRole.MANAGER: {
        # Employees
        Permission.EMPLOYEES_READ,

        # Attendance
        Permission.ATTENDANCE_READ,

        # Leave
        Permission.LEAVE_READ,
        Permission.LEAVE_APPROVE,

        # Goals
        Permission.GOALS_READ,
        Permission.GOALS_CREATE,
        Permission.GOALS_UPDATE,
        Permission.GOALS_APPROVE,

        # Performance
        Permission.PERFORMANCE_READ,
        Permission.PERFORMANCE_CREATE,
        Permission.PERFORMANCE_UPDATE,
        Permission.PERFORMANCE_REVIEW,
    },

    # ============================================================
    # TEAM LEAD
    # ============================================================
    UserRole.TEAM_LEAD: {
        # Employees
        Permission.EMPLOYEES_READ,

        # Attendance
        Permission.ATTENDANCE_READ,

        # Leave
        Permission.LEAVE_READ,
        Permission.LEAVE_APPROVE,

        # Goals
        Permission.GOALS_READ,
        Permission.GOALS_CREATE,
        Permission.GOALS_UPDATE,

        # Performance
        Permission.PERFORMANCE_READ,
        Permission.PERFORMANCE_CREATE,
        Permission.PERFORMANCE_UPDATE,
    },

    # ============================================================
    # EMPLOYEE
    # ============================================================
    UserRole.EMPLOYEE: {
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
    },

    # ============================================================
    # RECRUITER
    # ============================================================
    UserRole.RECRUITER: {
        # Employees
        Permission.EMPLOYEES_READ,

        # Recruitment
        Permission.RECRUITMENT_READ,
        Permission.RECRUITMENT_CREATE,
        Permission.RECRUITMENT_UPDATE,
        Permission.RECRUITMENT_DELETE,

        # Documents
        Permission.DOCUMENTS_READ,

        # Reports
        Permission.REPORTS_READ,
    },

    # ============================================================
    # PAYROLL ADMIN
    # ============================================================
    UserRole.PAYROLL_ADMIN: {
        # Employees
        Permission.EMPLOYEES_READ,

        # Payroll
        Permission.PAYROLL_READ,
        Permission.PAYROLL_CREATE,
        Permission.PAYROLL_UPDATE,
        Permission.PAYROLL_PROCESS,
        Permission.PAYROLL_REPORTS,

        # Payslips
        Permission.PAYSLIPS_READ,

        # Reports
        Permission.REPORTS_READ,
        Permission.REPORTS_CREATE,
    },
}

def has_permission(
    role: UserRole,
    permission: Permission,
) -> bool:
    return permission in ROLE_PERMISSIONS.get(role, set())


def get_role_permissions(role: UserRole) -> set[Permission]:
    return ROLE_PERMISSIONS.get(role, set())