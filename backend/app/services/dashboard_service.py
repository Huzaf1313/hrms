from datetime import date, datetime

from app.repositories.employee_repository import EmployeeRepository


class DashboardService:
    def __init__(self):
        self.employee_repository = EmployeeRepository()

    async def get_dashboard_data(self):
        total_headcount = await self.employee_repository.count_employees()
        celebrations = await self.get_celebrations()

        return {
            "total_headcount": total_headcount,
            "attendance_rate": None,
            "on_leave_today": 0,
            "celebrations": celebrations,
            "hiring_pipeline": {
                "applied": 0,
                "screened": 0,
                "interview": 0,
                "offered": 0,
            },
        }

    async def get_celebrations(self, today: date | None = None):
        """Birthdays and work anniversaries falling on `today`.

        Both dates live on the employee document, so a celebration is simply
        "the month-day of date_of_birth or joining_date equals today's
        month-day". One employee can produce two entries - someone can share
        their birthday with their joining anniversary.
        """
        today = today or date.today()
        targets = self._month_day_targets(today)

        candidates = await self.employee_repository.get_celebration_candidates(
            targets
        )

        celebrations = []

        for employee in candidates:
            display_name = self._display_name(employee)

            if self._matches(employee.get("date_of_birth"), targets):
                celebrations.append(
                    {
                        "employee_id": employee.get("employee_id", ""),
                        "name": display_name,
                        "type": "birthday",
                        "message": "Birthday today!",
                        "avatar_url": employee.get("avatar_url"),
                        "designation": employee.get("designation"),
                        "years": None,
                    }
                )

            joining_date = employee.get("joining_date")

            if self._matches(joining_date, targets):
                years = self._completed_years(joining_date, today)

                # Year 0 means they joined today - a new joiner, not an
                # anniversary.
                if years >= 1:
                    celebrations.append(
                        {
                            "employee_id": employee.get("employee_id", ""),
                            "name": display_name,
                            "type": "anniversary",
                            "message": (
                                f"Work Anniversary ({years} "
                                f"{'Year' if years == 1 else 'Years'})"
                            ),
                            "avatar_url": employee.get("avatar_url"),
                            "designation": employee.get("designation"),
                            "years": years,
                        }
                    )

        # Deterministic order so the ticker does not reshuffle on refresh.
        celebrations.sort(key=lambda item: (item["type"], item["name"]))

        return celebrations

    def _month_day_targets(self, today: date) -> list[str]:
        """Month-day strings to match against.

        A 29 February birthday never coincides with today in a non-leap year,
        so on 28 February the 29th is treated as the event day instead.
        """
        targets = [today.strftime("%m-%d")]

        if (today.month, today.day) == (2, 28):
            targets.append("02-29")

        return targets

    def _matches(self, value, targets: list[str]) -> bool:
        if not isinstance(value, datetime):
            return False

        return value.strftime("%m-%d") in targets

    def _completed_years(self, joining_date: datetime, today: date) -> int:
        years = today.year - joining_date.year

        # The month-day already matched, except for the 29 February fallback
        # where the anniversary has technically not arrived yet today.
        if (today.month, today.day) < (joining_date.month, joining_date.day):
            years -= 1

        return years

    def _display_name(self, employee: dict) -> str:
        full_name = employee.get("full_name")

        if full_name:
            return full_name

        combined = (
            f'{employee.get("first_name", "")} '
            f'{employee.get("last_name", "")}'
        ).strip()

        # An empty name would render as a blank gap in the ticker, so fall
        # back to the employee number rather than showing nothing.
        return combined or employee.get("employee_id", "An employee")