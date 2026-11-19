from fastapi import APIRouter
from app.modules.exit.admin_router import router as admin_exit_requests_router
from app.modules.exit.employee_router import router as employee_exit_requests_router

router = APIRouter()
router.include_router(admin_exit_requests_router)
router.include_router(employee_exit_requests_router)
