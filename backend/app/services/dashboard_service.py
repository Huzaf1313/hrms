from datetime import date, datetime, timedelta, timezone
try:
    from zoneinfo import ZoneInfo
    IST = ZoneInfo("Asia/Kolkata")
except Exception:
    IST = timezone(timedelta(hours=5, minutes=30))

from app.core.roles import Permission, has_permission
from app.core.scope import visible_employee_codes
from app.repositories.admin_payslip_repository import AdminPayslipRepository
from app.repositories.employee_repository import EmployeeRepository
from app.services.employee_service import EmployeeService

MONTH_NAME_TO_NUM = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


class DashboardService:
    def __init__(self):
        self.employee_repository = EmployeeRepository()
        self.employee_service = EmployeeService()
        self.payslip_repository = AdminPayslipRepository()

    async def get_dashboard_data(self, current_user: dict | None = None):
        scope = self.employee_service._visibility_scope(current_user)

        total_headcount = await self.employee_repository.count_employees(scope)
        celebrations = await self.get_celebrations(scope=scope)
        payroll_summary = await self.get_payroll_summary(current_user=current_user)

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
            "payroll_summary": payroll_summary,
        }

    async def get_payroll_summary(self, current_user: dict | None = None) -> dict | None:
        role = current_user.get("role") if current_user else None
        role_value = getattr(role, "value", role)
        if not role_value or not has_permission(role_value, Permission.PAYROLL_READ):
            return None

        now_ist = datetime.now(IST)
        curr_year = now_ist.year
        curr_month = now_ist.month

        if curr_month == 1:
            prev_year = curr_year - 1
            prev_month = 12
        else:
            prev_year = curr_year
            prev_month = curr_month - 1

        all_records = await self.payslip_repository.get_all_records()

        # Respect employee visibility scope if manager/scoped
        scope = self.employee_service._visibility_scope(current_user)
        if scope:
            visible_codes = await visible_employee_codes(self.employee_repository, current_user)
            if visible_codes is not None:
                all_records = [
                    r for r in all_records
                    if r.get("employee_id") in visible_codes
                ]

        curr_records: list[dict] = []
        prev_records: list[dict] = []

        for rec in all_records:
            rec_y, rec_m = self._extract_record_period(rec, curr_year)
            if rec_y == curr_year and rec_m == curr_month:
                curr_records.append(rec)
            elif rec_y == prev_year and rec_m == prev_month:
                prev_records.append(rec)

        # Do not count pending or unprocessed payroll as processed payroll.
        # Avoid duplicate counting of payroll records by mapping unique employee records.
        curr_processed = self._deduplicate_and_filter_processed(curr_records)
        prev_processed = self._deduplicate_and_filter_processed(prev_records)

        curr_payroll = 0.0
        curr_expense = 0.0

        for r in curr_processed:
            gross = float(r.get("salary", {}).get("gross", 0.0) or 0.0)
            ded = float(r.get("deductions", {}).get("total", 0.0) or 0.0)
            net = float(r.get("net_salary", 0.0) or 0.0)
            if net == 0.0 and gross > 0:
                net = max(0.0, gross - ded)

            curr_payroll += net
            curr_expense += gross

        prev_payroll = 0.0
        prev_expense = 0.0

        for r in prev_processed:
            gross = float(r.get("salary", {}).get("gross", 0.0) or 0.0)
            ded = float(r.get("deductions", {}).get("total", 0.0) or 0.0)
            net = float(r.get("net_salary", 0.0) or 0.0)
            if net == 0.0 and gross > 0:
                net = max(0.0, gross - ded)

            prev_payroll += net
            prev_expense += gross

        curr_payroll = round(curr_payroll, 2)
        curr_expense = round(curr_expense, 2)

        if prev_payroll > 0:
            payroll_change = round(((curr_payroll - prev_payroll) / prev_payroll) * 100, 1)
        else:
            payroll_change = 0.0

        if prev_expense > 0:
            expense_change = round(((curr_expense - prev_expense) / prev_expense) * 100, 1)
        else:
            expense_change = 0.0

        return {
            "payroll_this_month": curr_payroll,
            "payroll_change_percent": payroll_change,
            "total_expenses": curr_expense,
            "expense_change_percent": expense_change,
            "processed_count": len(curr_processed),
            "currency": "INR",
        }

    @staticmethod
    def _extract_record_period(rec: dict, default_year: int) -> tuple[int | None, int | None]:
        p_start = rec.get("pay_period_start")
        if isinstance(p_start, (datetime, date)):
            return p_start.year, p_start.month

        m_str = str(rec.get("month") or "").strip().lower()
        rec_year = None
        rec_month = None

        if m_str:
            if len(m_str) >= 7 and m_str[4] == "-":
                try:
                    return int(m_str[:4]), int(m_str[5:7])
                except ValueError:
                    pass

            parts = m_str.replace(",", " ").split()
            for p in parts:
                if p.isdigit() and len(p) == 4:
                    rec_year = int(p)
                elif p in MONTH_NAME_TO_NUM:
                    rec_month = MONTH_NAME_TO_NUM[p]

            if not rec_month:
                for k, v in MONTH_NAME_TO_NUM.items():
                    if k in m_str:
                        rec_month = v
                        break

        if rec_year is None:
            paid_on = rec.get("payment", {}).get("paid_on")
            if isinstance(paid_on, (datetime, date)):
                rec_year = paid_on.year
                if not rec_month:
                    rec_month = paid_on.month
            else:
                c_at = rec.get("created_at")
                if isinstance(c_at, (datetime, date)):
                    rec_year = c_at.year
                    if not rec_month:
                        rec_month = c_at.month
                else:
                    rec_year = default_year

        return rec_year, rec_month

    @staticmethod
    def _deduplicate_and_filter_processed(records: list[dict]) -> list[dict]:
        processed = []
        for r in records:
            status = (
                r.get("payment", {}).get("status")
                or r.get("status")
                or ""
            ).strip().lower()
            if status in {"paid", "credited"}:
                processed.append(r)

        by_emp: dict[str, dict] = {}
        for r in processed:
            emp_id = str(r.get("employee_id") or "")
            if not emp_id:
                by_emp[str(r.get("_id", id(r)))] = r
                continue

            if emp_id not in by_emp:
                by_emp[emp_id] = r
            else:
                curr = by_emp[emp_id]
                curr_dt = curr.get("updated_at") or curr.get("created_at") or datetime.min
                new_dt = r.get("updated_at") or r.get("created_at") or datetime.min
                if new_dt > curr_dt:
                    by_emp[emp_id] = r

        return list(by_emp.values())

    async def get_celebrations(
        self,
        today: date | None = None,
        scope: dict | None = None,
    ):
        """Birthdays and work anniversaries falling on `today`.

        Both dates live on the employee document, so a celebration is simply
        "the month-day of date_of_birth or joining_date equals today's
        month-day". One employee can produce two entries - someone can share
        their birthday with their joining anniversary.
        """
        today = today or date.today()
        targets = self._month_day_targets(today)

        candidates = await self.employee_repository.get_celebration_candidates(
            targets,
            scope,
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