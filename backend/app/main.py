import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.modules.payroll.admin_payslip_router import router as admin_payslip_router
from app.modules.leaves.admin_router import router as leaves_router
from app.modules.attendance.admin_router import router as attendance_router
from app.modules.shifts.router import router as shifts_router
from app.modules.holidays.router import router as holidays_router
from app.modules.dashboard.admin_notifications_router import router as admin_notifications_router
from app.modules.support.admin_router import router as admin_support_tickets_router
from app.modules.auth.router import router as auth_router
from app.modules.departments.router import router as departments_router
from app.modules.employees.router import router as employees_router
from app.modules.dashboard.health_router import router as health_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.auth.users_router import router as users_router
from app.modules.attendance.employee_router import router as employee_attendance_router
from app.modules.attendance.regularization_router import (
    router as employee_attendance_regularization_router,
)

from app.modules.payroll.salary_structures_router import (
    router as admin_salary_structures_router,
)

from app.modules.payroll.deductions_router import (
    router as admin_deductions_router,
)

from app.modules.announcements.admin_router import (
    router as announcements_router,
)

from app.modules.employees.documents_router import router as employee_documents_router
from app.modules.announcements.employee_router import (
    router as employee_announcement_router,
)

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.cache import init_redis, close_redis
from app.db.database import connect_to_database, close_database_connection
from app.modules.leaves.employee_router import (
    router as employee_leave_router,
)
from app.modules.payroll.employee_payroll_router import (
    router as employee_payroll_router,
)

from app.modules.payroll import employee_payslip_router as employee_payslip

from app.repositories.employee_attendance_repository import (
    EmployeeAttendanceRepository,
)
from app.repositories.employee_attendance_regularization_repository import (
    EmployeeAttendanceRegularizationRepository,
)
from app.repositories.employee_leave_repository import (
    EmployeeLeaveRepository,
)
from app.repositories.employee_payroll_repository import (
    EmployeePayrollRepository,
)
from app.repositories.admin_announcement_repository import (
    AdminAnnouncementRepository,
)
from app.repositories.shift_repository import ShiftRepository
from app.repositories.holiday_repository import HolidayRepository
from app.repositories.employee_support_ticket_repository import (
    EmployeeSupportTicketRepository,
)

from app.modules.dashboard.employee_notification_router import (
    router as employee_notification_router,
)

from app.repositories.employee_notification_repository import (
    EmployeeNotificationRepository,
)
from app.modules.support.employee_router import (
    router as employee_support_tickets_router,
)

from app.modules.exit.employee_router import router as employee_exit_requests_router
from app.modules.exit.admin_router import router as admin_exit_requests_router
from app.repositories.employee_exit_request_repository import ExitRequestRepository
from app.modules.recruitment.router import router as recruitment_router
from app.modules.assets.router import router as assets_router
from app.repositories.asset_repository import AssetRepository
from app.repositories.asset_request_repository import AssetRequestRepository
from app.repositories.candidate_repository import CandidateRepository
from app.repositories.job_position_repository import JobPositionRepository
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.activity_repository import ActivityRepository
from app.repositories.user_repository import UserRepository
from app.modules.employees.identity import backfill_minted_profiles
from app.modules.auth.user_service import UserService
from app.modules.employees.profile_photo_router import router as employee_profile_photo_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_database()
    await init_redis()

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    if settings.BOOTSTRAP_HR_EMAIL and settings.BOOTSTRAP_HR_PASSWORD:
        created = await UserService().bootstrap_hr_admin(
            email=settings.BOOTSTRAP_HR_EMAIL,
            password=settings.BOOTSTRAP_HR_PASSWORD,
            full_name=settings.BOOTSTRAP_HR_NAME,
        )

        if created:
            print(
                f"Bootstrapped HR account: {settings.BOOTSTRAP_HR_EMAIL}"
            )

    # Idempotent like the HR bootstrap: an existing email is left untouched,
    # so changing the password here later does not reset the account.
    if (
        settings.BOOTSTRAP_SUPER_ADMIN_EMAIL
        and settings.BOOTSTRAP_SUPER_ADMIN_PASSWORD
    ):
        created = await UserService().bootstrap_super_admin(
            email=settings.BOOTSTRAP_SUPER_ADMIN_EMAIL,
            password=settings.BOOTSTRAP_SUPER_ADMIN_PASSWORD,
            full_name=settings.BOOTSTRAP_SUPER_ADMIN_NAME,
        )

        if created:
            print(
                "Bootstrapped super admin account: "
                f"{settings.BOOTSTRAP_SUPER_ADMIN_EMAIL}"
            )

    filled = await backfill_minted_profiles(UserRepository().collection)

    if filled:
        print(f"Backfilled joining_date for {filled} minted employee records")

    await EmployeeRepository().ensure_indexes()
    await ActivityRepository().ensure_indexes()

    shift_repository = ShiftRepository()
    await shift_repository.ensure_indexes()

    await HolidayRepository().ensure_indexes()

    await EmployeeSupportTicketRepository().ensure_indexes()

    attendance_repository = EmployeeAttendanceRepository()
    await attendance_repository.ensure_indexes()

    regularization_repository = EmployeeAttendanceRegularizationRepository()
    await regularization_repository.ensure_indexes()

    employee_leave_repository = EmployeeLeaveRepository()
    await employee_leave_repository.ensure_indexes()

    employee_payroll_repository = EmployeePayrollRepository()
    await employee_payroll_repository.ensure_indexes()

    announcement_repository = AdminAnnouncementRepository()
    await announcement_repository.ensure_indexes()
    await JobPositionRepository().ensure_indexes()
    await CandidateRepository().ensure_indexes()
    await AssetRepository().ensure_indexes()
    await AssetRequestRepository().ensure_indexes()

    notification_repository = EmployeeNotificationRepository()
    await notification_repository.ensure_indexes()

    exit_request_repository = ExitRequestRepository()
    await exit_request_repository.ensure_indexes()

    yield

    await close_redis()
    await close_database_connection()


def _cors_headers_for_request(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin")
    headers: dict[str, str] = {}
    if origin:
        allowed = settings.cors_origins_list
        if (
            origin in allowed
            or "*" in allowed
            or origin.startswith("http://localhost:")
            or origin.startswith("http://127.0.0.1:")
        ):
            headers["Access-Control-Allow-Origin"] = origin
            headers["Access-Control-Allow-Credentials"] = "true"
            headers["Access-Control-Allow-Methods"] = "*"
            headers["Access-Control-Allow-Headers"] = "*"
    return headers


async def app_exception_handler(
    request: Request,
    exc: AppException,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.message,
            "data": None,
        },
        headers=_cors_headers_for_request(request),
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": str(exc.detail),
            "data": None,
        },
        headers=_cors_headers_for_request(request),
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "message": "Validation error",
            "data": exc.errors(),
        },
        headers=_cors_headers_for_request(request),
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": str(exc),
            "data": None,
        },
        headers=_cors_headers_for_request(request),
    )


app = FastAPI(
    title="HRMS API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_exception_handler(
    AppException,
    app_exception_handler,
)
app.add_exception_handler(
    StarletteHTTPException,
    http_exception_handler,
)
app.add_exception_handler(
    RequestValidationError,
    validation_exception_handler,
)
app.add_exception_handler(
    Exception,
    unhandled_exception_handler,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serves uploaded files (e.g. announcement attachments) at /uploads/...
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount(
    f"/{settings.UPLOAD_DIR}",
    StaticFiles(directory=settings.UPLOAD_DIR),
    name="uploads",
)

app.include_router(
    health_router,
    prefix="/api/v1",
    tags=["Health"],
)

# Also served unprefixed: uptime monitors conventionally poll /health.
app.include_router(
    health_router,
    tags=["Health"],
)

app.include_router(
    auth_router,
    prefix="/api/v1",
    tags=["Authentication"],
)

app.include_router(
    departments_router,
    prefix="/api/v1",
    tags=["Departments"],
)

app.include_router(
    employees_router,
    prefix="/api/v1",
    tags=["Employees"],
)

app.include_router(
    leaves_router,
    prefix="/api/v1",
    tags=["Admin Leaves"],
)

app.include_router(
    attendance_router,
    prefix="/api/v1",
    tags=["Admin Attendance"],
)

app.include_router(
    shifts_router,
    prefix="/api/v1",
    tags=["Shifts"],
)

app.include_router(
    holidays_router,
    prefix="/api/v1",
    tags=["Holidays"],
)

app.include_router(
    admin_notifications_router,
    prefix="/api/v1",
    tags=["Admin Notifications"],
)

app.include_router(
    admin_support_tickets_router,
    prefix="/api/v1",
    tags=["Admin Support Tickets"],
)

app.include_router(
    employee_attendance_regularization_router,
    prefix="/api/v1",
    tags=["Employee Attendance Regularization"]
)

app.include_router(
    employee_attendance_router,
    prefix="/api/v1",
    tags=["Employee Attendance"]
)

app.include_router(
    employee_leave_router,
    prefix="/api/v1",
    tags=["Employee Leaves"],
)

app.include_router(
    employee_payroll_router,
    prefix="/api/v1",
    tags=["Employee Payroll"], 
)

app.include_router(
    admin_salary_structures_router,
    prefix="/api/v1",
    tags=["Admin Salary Structures"],
)

app.include_router(
    admin_deductions_router,
    prefix="/api/v1",
    tags=["Deductions & Contributions"],
)

app.include_router(
    announcements_router,
    prefix="/api/v1",
    tags=["Announcements"],
)

app.include_router(
    employee_announcement_router,
    prefix="/api/v1",
    tags=["Employee Announcements"],
)

app.include_router(
    employee_payslip.router,
    prefix="/api/v1",
)

app.include_router(
    users_router,
    prefix="/api/v1",
    tags=["Users"],
)

app.include_router(
    dashboard_router,
    prefix="/api/v1",
    tags=["Dashboard"],
)

app.include_router(
    employee_documents_router,
    prefix="/api/v1",
)

app.include_router(
    employee_profile_photo_router, 
    prefix="/api/v1"
)

app.include_router(
    employee_notification_router,
    prefix="/api/v1",
)

app.include_router(
    admin_payslip_router,
    prefix="/api/v1",
)

app.include_router(
    employee_support_tickets_router,
    prefix="/api/v1",
)

app.include_router(employee_exit_requests_router, prefix="/api/v1")

app.include_router(admin_exit_requests_router, prefix="/api/v1")
    
app.include_router(
    recruitment_router,
    prefix="/api/v1",
)

app.include_router(
    assets_router,
    prefix="/api/v1",
)
