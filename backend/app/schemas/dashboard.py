from datetime import datetime

from pydantic import BaseModel


class Celebration(BaseModel):
    employee_id: str
    name: str
    # "birthday" or "anniversary" - the UI maps this to an icon.
    type: str
    message: str
    avatar_url: str | None = None
    designation: str | None = None
    # Completed years, for anniversaries only.
    years: int | None = None


class HiringPipeline(BaseModel):
    applied: int = 0
    screened: int = 0
    interview: int = 0
    offered: int = 0


class RecentActivity(BaseModel):
    id: str
    text: str
    actor_name: str = "System"
    target: str | None = None
    created_at: datetime


class DashboardPayrollSummary(BaseModel):
    payroll_this_month: float = 0.0
    payroll_change_percent: float = 0.0
    total_expenses: float = 0.0
    expense_change_percent: float = 0.0
    processed_count: int = 0
    currency: str = "INR"


class DashboardResponse(BaseModel):
    total_headcount: int = 0
    attendance_rate: float | None = None
    on_leave_today: int = 0
    celebrations: list[Celebration] = []
    hiring_pipeline: HiringPipeline = HiringPipeline()
    recent_activities: list[RecentActivity] = []
    payroll_summary: DashboardPayrollSummary | None = None
