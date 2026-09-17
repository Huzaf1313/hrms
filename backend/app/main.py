from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.admin_leaves import router as leaves_router
from app.api.v1.admin_attendance import router as attendance_router
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

from app.core.config import settings
from app.core.exceptions import AppException
from app.db.database import connect_to_database, close_database_connection
from app.api.v1.employee_leave import (
    router as employee_leave_router,
)
from app.api.v1.employee_payroll import (
    router as employee_payroll_router,
)

from app.api.v1.admin_salary_structures import (
    router as admin_salary_structures_router,
)

from app.api.v1.admin_deductions import (
    router as admin_deductions_router,
)

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

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_database()

    attendance_repository = EmployeeAttendanceRepository()
    await attendance_repository.ensure_indexes()

    regularization_repository = EmployeeAttendanceRegularizationRepository()
    await regularization_repository.ensure_indexes()

    employee_leave_repository = EmployeeLeaveRepository()
    await employee_leave_repository.ensure_indexes()

    employee_payroll_repository = EmployeePayrollRepository()
    await employee_payroll_repository.ensure_indexes()

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

app.include_router(
    health_router,
    prefix="/api/v1",
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
    employee_attendance_regularization_router,
    prefix="/api/v1",
    tags=["Employee Attendance Regularization"]
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
    users_router,
    prefix="/api/v1",
    tags=["Users"],
)

app.include_router(
    dashboard_router,
    prefix="/api/v1",
    tags=["Dashboard"],
)
