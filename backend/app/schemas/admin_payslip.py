from datetime import date, datetime

from pydantic import BaseModel, Field


class AdminPayslipCreate(BaseModel):
    employee_id: str = Field(min_length=1)
    month: str = Field(min_length=1)
    year: int = Field(ge=2000, le=2100)


class PayslipStatusUpdate(BaseModel):
    status: str = Field(min_length=1)


class AdminPayslipResponse(BaseModel):
    id: str
    employee_id: str
    month: str
    pay_period_start: date
    pay_period_end: date

    salary: dict
    deductions: dict

    net_salary: float = Field(ge=0)

    bank_details: dict
    payment: dict
    tax_details: dict

    created_at: datetime
    updated_at: datetime


class MonthlyPayrollAnalyticsItem(BaseModel):
    month: str
    month_name: str
    year: int
    month_num: int
    gross: float = 0.0
    deductions: float = 0.0
    net: float = 0.0
    total_expense: float = 0.0
    employee_count: int = 0
    records_count: int = 0


class PayrollSummaryMetrics(BaseModel):
    total_employees: int = 0
    processed_payroll: int = 0
    pending_payroll: int = 0
    total_payroll_amount: float = 0.0
    latest_month: str = ""
    period_gross: float = 0.0
    period_deductions: float = 0.0
    period_net: float = 0.0
    period_expense: float = 0.0
    new_joiners: int = 0
    unassigned_salary_structures: int = 0


class PayrollRecentRun(BaseModel):
    month: str
    processed_on: str
    progress: str
    status: str


class PayrollDepartmentSummary(BaseModel):
    department: str
    employees: int
    gross: float
    net: float
    status: str


class PayrollAnalyticsResponse(BaseModel):
    timeline: list[MonthlyPayrollAnalyticsItem]
    summary: PayrollSummaryMetrics
    available_years: list[int]
    recent_runs: list[PayrollRecentRun] = []
    departments: list[PayrollDepartmentSummary] = []