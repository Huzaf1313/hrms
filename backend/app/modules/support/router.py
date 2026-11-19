from fastapi import APIRouter
from app.modules.support.admin_router import router as admin_support_tickets_router
from app.modules.support.employee_router import router as employee_support_tickets_router

router = APIRouter()
router.include_router(admin_support_tickets_router)
router.include_router(employee_support_tickets_router)
