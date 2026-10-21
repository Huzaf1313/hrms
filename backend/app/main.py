import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.api.v1.admin_payslip import router as admin_payslip_router
from app.api.v1.admin_leaves import router as leaves_router
from app.api.v1.admin_attendance import router as attendance_router
from app.api.v1.shifts import router as shifts_router
from app.api.v1.holidays import router as holidays_router
from app.api.v1.admin_notifications import router as admin_notifications_router
from app.api.v1.admin_support_tickets import router as admin_support_tickets_router
from app.api.v1.auth import router as auth_router
from app.api.v1.departments import router as departments_router
from app.api.v1.employees import router as employees_router
from app.api.v1.health import router as health_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.users import router as users_router
from app.api.v1.employee_attendance import router as employee_attendance_router
from app.api.v1.employee_attendance_regularization import (
    router as employee_attendance_regularization_router,
)

from app.api.v1.admin_salary_structures import (
    router as admin_salary_structures_router,
)

from app.api.v1.admin_deductions import (
    router as admin_deductions_router,
)

from app.api.v1.admin_announcements import (
    router as announcements_router,
)

from app.api.v1.employee_documents import router as employee_documents_router
from app.api.v1.employee_announcement import (
    router as employee_announcement_router,
)

from app.core.config import settings
from app.core.exceptions import AppException
from app.db.database import connect_to_database, close_database_connection
from app.api.v1.employee_leave import (
    router as employee_leave_router,
)
from app.api.v1.employee_payroll import (
    router as employee_payroll_router,
)

from app.api.v1 import employee_payslip

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

from app.api.v1.employee_notification import (
    router as employee_notification_router,
)

from app.repositories.employee_notification_repository import (
    EmployeeNotificationRepository,
)
from app.api.v1.employee_support_tickets import (
    router as employee_support_tickets_router,
)

from app.api.v1.employee_exit_requests import router as employee_exit_requests_router
from app.api.v1.admin_exit_requests import router as admin_exit_requests_router
from app.repositories.employee_exit_request_repository import ExitRequestRepository
from app.api.v1.recruitment import router as recruitment_router
from app.api.v1.assets import router as assets_router
from app.repositories.asset_repository import AssetRepository
from app.repositories.asset_request_repository import AssetRequestRepository
from app.repositories.candidate_repository import CandidateRepository
from app.repositories.job_position_repository import JobPositionRepository


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_database()

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

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

    await close_database_connection()


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
    employee_announcement_router,
    prefix="/api/v1",
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
