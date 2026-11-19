from fastapi import APIRouter
from app.modules.announcements.admin_router import router as admin_announcements_router
from app.modules.announcements.employee_router import router as employee_announcements_router

router = APIRouter()
router.include_router(admin_announcements_router)
router.include_router(employee_announcements_router)
