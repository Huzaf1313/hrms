from app.repositories.employee_repository import EmployeeRepository


class DashboardService:
    def __init__(self):
        self.employee_repository = EmployeeRepository()

    async def get_dashboard_data(self):
        total_headcount = await self.employee_repository.count_employees()

        return {
            "total_headcount": total_headcount,
            "attendance_rate": None,
            "on_leave_today": 0,
            "celebrations": [],
            "hiring_pipeline": {
                "applied": 0,
                "screened": 0,
                "interview": 0,
                "offered": 0,
            },
        }