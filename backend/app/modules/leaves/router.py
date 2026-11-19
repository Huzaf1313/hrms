from fastapi import APIRouter
from app.modules.leaves.admin_router import router as admin_leaves_router
from app.modules.leaves.employee_router import router as employee_leave_router

router = APIRouter()
router.include_router(admin_leaves_router)
router.include_router(employee_leave_router)
