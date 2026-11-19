from fastapi import APIRouter
from app.modules.payroll.admin_payslip_router import router as admin_payslip_router
from app.modules.payroll.salary_structures_router import router as admin_salary_structures_router
from app.modules.payroll.deductions_router import router as admin_deductions_router
from app.modules.payroll.employee_payroll_router import router as employee_payroll_router
from app.modules.payroll.employee_payslip_router import router as employee_payslip_router

router = APIRouter()
router.include_router(admin_payslip_router)
router.include_router(admin_salary_structures_router)
router.include_router(admin_deductions_router)
router.include_router(employee_payroll_router)
router.include_router(employee_payslip_router)
