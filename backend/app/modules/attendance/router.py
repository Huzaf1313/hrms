from fastapi import APIRouter
from app.modules.attendance.admin_router import router as admin_attendance_router
from app.modules.attendance.employee_router import router as employee_attendance_router
from app.modules.attendance.regularization_router import router as employee_attendance_regularization_router

router = APIRouter()
router.include_router(admin_attendance_router)
router.include_router(employee_attendance_router)
router.include_router(employee_attendance_regularization_router)
