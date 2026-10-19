from datetime import date, datetime, timezone
from calendar import monthrange

from app.core.exceptions import AppException
from app.repositories.employee_repository import EmployeeRepository
from app.repositories.admin_salary_structure_repository import (
    AdminSalaryStructureRepository,
)
from app.repositories.admin_payslip_repository import (
    AdminPayslipRepository,
)
from app.services.admin_deduction_service import AdminDeductionService


class AdminPayslipService:
    def __init__(self):
        self.payslip_repository = AdminPayslipRepository()
        self.employee_repository = EmployeeRepository()
        self.salary_structure_repository = AdminSalaryStructureRepository()
        self.deduction_service = AdminDeductionService()

    async def create_payslip(
        self,
        employee_id: str,
        month: str,
        year: int,
    ):
        # 1. Find employee
        employee = await self.employee_repository.get_by_employee_id(
            employee_id
        )

        if not employee:
            raise AppException("Employee not found", 404)

        # 2. Check salary structure
        salary_structure_name = employee.get("salary_structure")

        if not salary_structure_name:
            raise AppException(
                "Salary structure is not assigned to this employee",
                400,
            )

        # 3. Find salary structure
        salary_structure = (
            await self.salary_structure_repository.get_by_name(
                salary_structure_name
            )
        )

        if not salary_structure:
            raise AppException(
                f"Salary structure '{salary_structure_name}' not found",
                404,
            )

        # 4. Calculate pay period
        month_number = self._get_month_number(month)

        last_day = monthrange(year, month_number)[1]

        pay_period_start = date(year, month_number, 1)
        pay_period_end = date(year, month_number, last_day)

        # 5. Prevent duplicate payslip
        existing = (
            await self.payslip_repository.get_by_employee_and_month(
                employee_id,
                month,
            )
        )

        if existing:
            raise AppException(
                "Payslip already exists for this employee and month",
                409,
            )

        # 6. Read earnings from salary structure
        earnings = salary_structure.get("earnings", [])

        if not earnings:
            raise AppException(
                "No earnings are configured in the salary structure",
                400,
            )

        gross_salary = round(
            sum(
                float(earning.get("amount", 0))
                for earning in earnings
            ),
            2,
        )

        # 7. Calculate deductions
        deduction_result = (
            await self.deduction_service.calculate_deductions(
                basic_salary=self._get_basic_salary(earnings),
                annual_income=gross_salary * 12,
            )
        )

        total_deductions = deduction_result.total_deductions

        # 8. Calculate net salary
        net_salary = round(
            gross_salary - total_deductions,
            2,
        )

        if net_salary < 0:
            raise AppException(
                "Net salary cannot be negative",
                400,
            )

        # 9. Prepare deduction details
        deduction_items = {}

        for result in deduction_result.results:
            if result.type == "deduction":
                deduction_items[result.code.lower()] = (
                    result.calculated_amount
                )

        deduction_items["total"] = total_deductions

        # 10. Prepare bank details
        bank_information = employee.get("bank_information") or {}

        account_number = bank_information.get("account_number", "")

        bank_details = {
            "bank_name": bank_information.get("bank_name", ""),
            "account_last4": (
                account_number[-4:]
                if account_number
                else "0000"
            ),
        }

        # 11. Prepare payroll document
        payroll_data = {
            "employee_id": employee_id,
            "month": month,
            "pay_period_start": pay_period_start,
            "pay_period_end": pay_period_end,
            "salary": {
                "basic": self._get_basic_salary(earnings),
                "earnings": earnings,
                "gross": gross_salary,
            },
            "deductions": deduction_items,
            "net_salary": net_salary,
            "bank_details": bank_details,
            "payment": {
                "paid_on": None,
                "status": "Processing",
            },
            "tax_details": {
                "taxable_income": gross_salary * 12,
                "tax_deducted": 0,
            },
        }

        # 12. Save payroll
        payroll = await self.payslip_repository.create(
            payroll_data
        )

        return self._serialize(payroll)

    async def get_all_payslips(
        self,
        page: int = 1,
        limit: int = 20,
    ):
        if page < 1:
            raise AppException(
                "Page must be greater than 0",
                400,
            )

        if limit < 1 or limit > 100:
            raise AppException(
                "Limit must be between 1 and 100",
                400,
            )

        skip = (page - 1) * limit

        payslips = await self.payslip_repository.get_all(
            skip=skip,
            limit=limit,
        )

        total = await self.payslip_repository.count()

        return {
            "items": [
                self._serialize(payslip)
                for payslip in payslips
            ],
            "page": page,
            "limit": limit,
            "total": total,
            "total_pages": (total + limit - 1) // limit,
        }

    async def get_payslip_by_id(self, payslip_id: str):
        payslip = await self.payslip_repository.get_by_id(
            payslip_id
        )

        if not payslip:
            raise AppException(
                "Payslip not found",
                404,
            )

        return self._serialize(payslip)

    async def download_payslip(self, payslip_id: str):
        raise AppException(
            "Payslip PDF download has been disabled",
            410,
        )

    @staticmethod
    def _get_basic_salary(earnings: list[dict]) -> float:
        for earning in earnings:
            label = str(
                earning.get("label", "")
            ).strip().lower()

            if label in {
                "basic",
                "basic salary",
                "basic pay",
            }:
                return float(
                    earning.get("amount", 0)
                )

        # If no explicitly named Basic Salary exists,
        # use the first earning as the basic amount.
        return float(
            earnings[0].get("amount", 0)
        )

    @staticmethod
    def _get_month_number(month: str) -> int:
        month_map = {
            "january": 1,
            "february": 2,
            "march": 3,
            "april": 4,
            "may": 5,
            "june": 6,
            "july": 7,
            "august": 8,
            "september": 9,
            "october": 10,
            "november": 11,
            "december": 12,
        }

        month_number = month_map.get(
            month.strip().lower()
        )

        if not month_number:
            raise AppException(
                "Invalid month name",
                400,
            )

        return month_number

    @staticmethod
    def _serialize(document: dict):
        if not document:
            return None

        return {
            "id": str(document["_id"]),
            "employee_id": document["employee_id"],
            "month": document["month"],
            "pay_period_start": document["pay_period_start"],
            "pay_period_end": document["pay_period_end"],
            "salary": document.get("salary", {}),
            "deductions": document.get("deductions", {}),
            "net_salary": document.get("net_salary", 0),
            "bank_details": document.get("bank_details", {}),
            "payment": document.get("payment", {}),
            "tax_details": document.get("tax_details", {}),
            "created_at": document.get("created_at"),
            "updated_at": document.get("updated_at"),
        }

    async def get_payroll_analytics(
        self,
        year: int | None = None,
        months: int | None = 6,
    ):
        all_records = await self.payslip_repository.get_all_records()

        now = datetime.now(timezone.utc)
        current_year = now.year

        years_set = {current_year}
        for rec in all_records:
            p_start = rec.get("pay_period_start")
            if isinstance(p_start, (datetime, date)):
                years_set.add(p_start.year)
            c_at = rec.get("created_at")
            if isinstance(c_at, (datetime, date)):
                years_set.add(c_at.year)

        available_years = sorted(list(years_set), reverse=True)

        month_map = {
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

        bucketed: dict[tuple[int, int], list[dict]] = {}
        for rec in all_records:
            rec_year = None
            rec_month_num = None

            p_start = rec.get("pay_period_start")
            if isinstance(p_start, (datetime, date)):
                rec_year = p_start.year
                rec_month_num = p_start.month
            elif rec.get("month"):
                m_str = str(rec.get("month")).strip().lower()
                parts = m_str.split()
                for p in parts:
                    if p.isdigit() and len(p) == 4:
                        rec_year = int(p)
                    elif p in month_map:
                        rec_month_num = month_map[p]

                if not rec_month_num:
                    for k, v in month_map.items():
                        if k in m_str:
                            rec_month_num = v
                            break

            if rec_year is None:
                c_at = rec.get("created_at")
                if isinstance(c_at, (datetime, date)):
                    rec_year = c_at.year
                else:
                    rec_year = current_year

            if rec_month_num is not None:
                key = (rec_year, rec_month_num)
                bucketed.setdefault(key, []).append(rec)

        if year is not None:
            window = [(year, m) for m in range(1, 13)]
        else:
            n_months = months if (months and 1 <= months <= 24) else 6
            window = []
            curr_y = now.year
            curr_m = now.month
            for i in range(n_months - 1, -1, -1):
                total_m = curr_y * 12 + (curr_m - 1) - i
                y = total_m // 12
                m = (total_m % 12) + 1
                window.append((y, m))

        month_short_names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        month_full_names = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

        timeline = []
        period_gross = 0.0
        period_deductions = 0.0
        period_net = 0.0
        period_expense = 0.0

        for (y, m) in window:
            recs = bucketed.get((y, m), [])
            m_gross = 0.0
            m_deductions = 0.0
            m_net = 0.0
            emp_ids = set()

            for r in recs:
                gross = float(r.get("salary", {}).get("gross", 0.0) or 0.0)
                ded = float(r.get("deductions", {}).get("total", 0.0) or 0.0)
                net = float(r.get("net_salary", 0.0) or 0.0)

                if ded == 0.0 and gross > 0 and net > 0 and gross > net:
                    ded = round(gross - net, 2)
                elif net == 0.0 and gross > 0:
                    net = round(max(0.0, gross - ded), 2)

                m_gross += gross
                m_deductions += ded
                m_net += net
                if r.get("employee_id"):
                    emp_ids.add(r.get("employee_id"))

            m_gross = round(m_gross, 2)
            m_deductions = round(m_deductions, 2)
            m_net = round(m_net, 2)
            m_expense = m_gross

            period_gross += m_gross
            period_deductions += m_deductions
            period_net += m_net
            period_expense += m_expense

            timeline.append({
                "month": month_short_names[m],
                "month_name": month_full_names[m],
                "year": y,
                "month_num": m,
                "gross": m_gross,
                "deductions": m_deductions,
                "net": m_net,
                "total_expense": m_expense,
                "employee_count": len(emp_ids),
                "records_count": len(recs),
            })

        total_employees = await self.employee_repository.count_employees()

        latest_key = None
        if bucketed:
            latest_key = max(bucketed.keys())

        latest_month_str = ""
        processed_count = 0
        total_payroll_amount = 0.0

        if latest_key:
            ly, lm = latest_key
            latest_month_str = f"{month_full_names[lm]} {ly}"
            latest_recs = bucketed[latest_key]
            latest_emps = {r.get("employee_id") for r in latest_recs if r.get("employee_id")}
            processed_count = len(latest_emps)
            total_payroll_amount = round(sum(float(r.get("net_salary", 0.0) or 0.0) for r in latest_recs), 2)

        pending_payroll = max(0, total_employees - processed_count)

        summary = {
            "total_employees": total_employees,
            "processed_payroll": processed_count,
            "pending_payroll": pending_payroll,
            "total_payroll_amount": total_payroll_amount,
            "latest_month": latest_month_str,
            "period_gross": round(period_gross, 2),
            "period_deductions": round(period_deductions, 2),
            "period_net": round(period_net, 2),
            "period_expense": round(period_expense, 2),
        }

        recent_runs = []
        if bucketed:
            sorted_keys = sorted(bucketed.keys(), reverse=True)[:5]
            for (by, bm) in sorted_keys:
                brecs = bucketed[(by, bm)]
                b_emps = {r.get("employee_id") for r in brecs if r.get("employee_id")}
                dates = [
                    r.get("created_at") or r.get("pay_period_start")
                    for r in brecs
                    if r.get("created_at") or r.get("pay_period_start")
                ]
                run_date_str = ""
                if dates:
                    dt = max(dates)
                    if isinstance(dt, (datetime, date)):
                        run_date_str = dt.strftime("%d %b %Y")
                if not run_date_str:
                    run_date_str = f"25 {month_short_names[bm]} {by}"

                all_completed = all(r.get("payment", {}).get("status") == "Credited" for r in brecs)
                status = "Completed" if all_completed else "Processing"

                recent_runs.append({
                    "month": f"{month_full_names[bm]} {by}",
                    "processed_on": run_date_str,
                    "progress": f"{len(b_emps)}/{total_employees}",
                    "status": status,
                })

        departments = []
        if latest_key:
            latest_recs = bucketed[latest_key]
            dept_docs = await self.payslip_repository.collection.database["departments"].find({}).to_list(length=100)
            dept_map = {str(d["_id"]): d.get("name", "Unknown") for d in dept_docs}

            emp_ids = [r.get("employee_id") for r in latest_recs if r.get("employee_id")]
            user_docs = await self.employee_repository.collection.find(
                {"employee_id": {"$in": emp_ids}}
            ).to_list(length=len(emp_ids))
            emp_to_dept = {}
            for u in user_docs:
                d_id = str(u.get("department_id", ""))
                d_name = dept_map.get(d_id, u.get("department") or "General")
                emp_to_dept[u["employee_id"]] = d_name

            dept_agg: dict[str, dict] = {}
            for r in latest_recs:
                eid = r.get("employee_id")
                d_name = emp_to_dept.get(eid, "General")
                if d_name not in dept_agg:
                    dept_agg[d_name] = {"employees": set(), "gross": 0.0, "net": 0.0, "status": "Completed"}
                if eid:
                    dept_agg[d_name]["employees"].add(eid)
                dept_agg[d_name]["gross"] += float(r.get("salary", {}).get("gross", 0.0) or 0.0)
                dept_agg[d_name]["net"] += float(r.get("net_salary", 0.0) or 0.0)
                if r.get("payment", {}).get("status") != "Credited":
                    dept_agg[d_name]["status"] = "Processing"

            for d_name, d_info in dept_agg.items():
                departments.append({
                    "department": d_name,
                    "employees": len(d_info["employees"]),
                    "gross": round(d_info["gross"], 2),
                    "net": round(d_info["net"], 2),
                    "status": d_info["status"],
                })

        return {
            "timeline": timeline,
            "summary": summary,
            "available_years": available_years,
            "recent_runs": recent_runs,
            "departments": departments,
        }

