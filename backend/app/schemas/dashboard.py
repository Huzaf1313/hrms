from pydantic import BaseModel


class Celebration(BaseModel):
    name: str
    type: str
    message: str


class HiringPipeline(BaseModel):
    applied: int = 0
    screened: int = 0
    interview: int = 0
    offered: int = 0


class DashboardResponse(BaseModel):
    total_headcount: int = 0
    attendance_rate: float | None = None
    on_leave_today: int = 0
    celebrations: list[Celebration] = []
    hiring_pipeline: HiringPipeline = HiringPipeline()