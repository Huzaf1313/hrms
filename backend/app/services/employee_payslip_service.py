from calendar import monthrange
from datetime import date, datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.core.exceptions import AppException
from app.repositories.department_repository import DepartmentRepository
from app.repositories.employee_attendance_repository import (
    EmployeeAttendanceRepository,
)
from app.repositories.employee_leave_repository import (
    EmployeeLeaveRepository,
)
from app.repositories.employee_payroll_repository import (
    EmployeePayrollRepository,
)
from app.repositories.employee_repository import EmployeeRepository


class EmployeePayslipService:
    def __init__(self):
        self.payroll_repository = EmployeePayrollRepository()
        self.employee_repository = EmployeeRepository()
        self.department_repository = DepartmentRepository()
        self.attendance_repository = EmployeeAttendanceRepository()
        self.leave_repository = EmployeeLeaveRepository()

    async def get_payslip_data(
        self,
        payroll_id: str,
        employee_id: str,
    ):
        payroll = await self.payroll_repository.get_by_id(payroll_id)

        if not payroll:
            raise AppException(
                "Payroll record not found",
                404,
            )

        if payroll["employee_id"] != employee_id:
            raise AppException(
                "You are not authorized to access this payslip",
                403,
            )

        employee = await self.employee_repository.get_by_employee_id(
            employee_id
        )

        if not employee:
            raise AppException(
                "Employee not found",
                404,
            )

        department = None

        department_id = employee.get("department_id")

        if department_id:
            department = await self.department_repository.get_by_id(
                department_id
            )

        start_date = self._to_date(
            payroll["pay_period_start"]
        )
        end_date = self._to_date(
            payroll["pay_period_end"]
        )

        attendance_records = (
            await self.attendance_repository.get_by_date_range(
                start_date=start_date,
                end_date=end_date,
            )
        )

        employee_attendance = [
            record
            for record in attendance_records
            if record.get("employee_id") == employee_id
        ]

        approved_leaves = await self.leave_repository.get_balance_records(
            employee_id=employee_id
        )

        period_leaves = [
            leave
            for leave in approved_leaves
            if self._leave_overlaps_period(
                leave,
                start_date,
                end_date,
            )
        ]

        attendance_summary = self._calculate_attendance_summary(
            start_date=start_date,
            end_date=end_date,
            attendance_records=employee_attendance,
            approved_leaves=period_leaves,
        )

        return {
            "payroll": payroll,
            "employee": employee,
            "department": department,
            "attendance_summary": attendance_summary,
        }

    async def generate_payslip_pdf(
        self,
        payroll_id: str,
        employee_id: str,
    ) -> BytesIO:
        data = await self.get_payslip_data(
            payroll_id=payroll_id,
            employee_id=employee_id,
        )

        buffer = BytesIO()

        document = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=15 * mm,
            leftMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "PayslipTitle",
            parent=styles["Heading1"],
            alignment=TA_CENTER,
            fontSize=16,
            leading=20,
            spaceAfter=4,
        )

        subtitle_style = ParagraphStyle(
            "PayslipSubtitle",
            parent=styles["Normal"],
            alignment=TA_CENTER,
            fontSize=9,
            leading=12,
            textColor=colors.grey,
        )

        section_style = ParagraphStyle(
            "Section",
            parent=styles["Heading2"],
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#0d1e3e"),
            spaceBefore=8,
            spaceAfter=5,
        )

        normal_style = ParagraphStyle(
            "NormalPayslip",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=11,
        )

        right_style = ParagraphStyle(
            "RightPayslip",
            parent=normal_style,
            alignment=TA_RIGHT,
        )

        story = []

        story.append(
            Paragraph(
                "TRIMARKITY PVT. LTD.",
                title_style,
            )
        )

        story.append(
            Paragraph(
                "123 Business Park, Pune, India",
                subtitle_style,
            )
        )

        story.append(
            Paragraph(
                "payroll@company.com | +91 XXXXX XXXXX",
                subtitle_style,
            )
        )

        story.append(Spacer(1, 5))

        story.append(
            HRFlowable(
                width="100%",
                thickness=1,
                color=colors.HexColor("#0d1e3e"),
            )
        )

        story.append(Spacer(1, 8))

        payroll = data["payroll"]
        employee = data["employee"]
        department = data["department"]
        attendance = data["attendance_summary"]

        story.append(
            Paragraph(
                "SALARY SLIP",
                title_style,
            )
        )

        story.append(
            Paragraph(
                str(payroll["month"]).upper(),
                subtitle_style,
            )
        )

        story.append(Spacer(1, 8))

        story.append(
            Paragraph(
                "Employee Information",
                section_style,
            )
        )

        employee_name = " ".join(
            filter(
                None,
                [
                    employee.get("first_name"),
                    employee.get("last_name"),
                ],
            )
        )

        employee_rows = [
            [
                Paragraph("<b>Employee Name</b>", normal_style),
                Paragraph(employee_name or "Not available", normal_style),
                Paragraph("<b>Employee ID</b>", normal_style),
                Paragraph(employee.get("employee_id", "Not available"), normal_style),
            ],
            [
                Paragraph("<b>Designation</b>", normal_style),
                Paragraph(employee.get("designation", "Not available"), normal_style),
                Paragraph("<b>Department</b>", normal_style),
                Paragraph(
                    department.get("name", "Not available")
                    if department
                    else "Not available",
                    normal_style,
                ),
            ],
            [
                Paragraph("<b>Location</b>", normal_style),
                Paragraph(employee.get("work_location") or "Not available", normal_style),
                Paragraph("<b>Date of Joining</b>", normal_style),
                Paragraph(
                    self._format_date(employee.get("joining_date")),
                    normal_style,
                ),
            ],
            [
                Paragraph("<b>Pay Period</b>", normal_style),
                Paragraph(
                    f"{self._format_date(payroll['pay_period_start'])} - "
                    f"{self._format_date(payroll['pay_period_end'])}",
                    normal_style,
                ),
                Paragraph("<b>Pay Date</b>", normal_style),
                Paragraph(
                    self._format_date(
                        payroll.get("payment", {}).get("paid_on")
                    ),
                    normal_style,
                ),
            ],
        ]

        employee_table = Table(
            employee_rows,
            colWidths=[30 * mm, 55 * mm, 30 * mm, 55 * mm],
        )

        employee_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ]
            )
        )

        story.append(employee_table)

        story.append(
            Paragraph(
                "Bank & Tax Information",
                section_style,
            )
        )

        bank_details = employee.get("bank_information") or {}
        payroll_bank = payroll.get("bank_details") or {}

        account_last4 = (
            payroll_bank.get("account_last4")
            or (
                str(bank_details.get("account_number", ""))[-4:]
                if bank_details.get("account_number")
                else ""
            )
        )

        bank_rows = [
            [
                Paragraph("<b>Bank Name</b>", normal_style),
                Paragraph(
                    payroll_bank.get("bank_name")
                    or bank_details.get("bank_name")
                    or "Not available",
                    normal_style,
                ),
                Paragraph("<b>Account Number</b>", normal_style),
                Paragraph(
                    f"**** {account_last4}"
                    if account_last4
                    else "Not available",
                    normal_style,
                ),
            ],
            [
                Paragraph("<b>PAN</b>", normal_style),
                Paragraph("Not available", normal_style),
                Paragraph("<b>UAN</b>", normal_style),
                Paragraph("Not available", normal_style),
            ],
        ]

        bank_table = Table(
            bank_rows,
            colWidths=[30 * mm, 55 * mm, 30 * mm, 55 * mm],
        )

        bank_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                ]
            )
        )

        story.append(bank_table)

        story.append(
            Paragraph(
                "Salary Details",
                section_style,
            )
        )

        salary = payroll.get("salary") or {}
        deductions = payroll.get("deductions") or {}

        earnings = [
            ["EARNINGS", "AMOUNT"],
            ["Basic Salary", self._currency(salary.get("basic", 0))],
            ["HRA", self._currency(salary.get("hra", 0))],
            [
                "Special Allowance",
                self._currency(salary.get("special_allowance", 0)),
            ],
            ["Conveyance", self._currency(salary.get("conveyance", 0))],
            [
                "Other Allowance",
                self._currency(salary.get("other_allowance", 0)),
            ],
            ["Gross Earnings", self._currency(salary.get("gross", 0))],
        ]

        deduction_rows = [
            ["DEDUCTIONS", "AMOUNT"],
            ["Provident Fund", self._currency(deductions.get("pf", 0))],
            [
                "Professional Tax",
                self._currency(deductions.get("pt", 0)),
            ],
            [
                "Income Tax / TDS",
                self._currency(deductions.get("tds", 0)),
            ],
            ["Total Deductions", self._currency(deductions.get("total", 0))],
        ]

        salary_table = Table(
            [
                [
                    Table(earnings, colWidths=[48 * mm, 35 * mm]),
                    Table(deduction_rows, colWidths=[48 * mm, 35 * mm]),
                ]
            ],
            colWidths=[88 * mm, 88 * mm],
        )

        for nested_table in salary_table._cellvalues[0]:
            nested_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0d1e3e")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )

        salary_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ]
            )
        )

        story.append(salary_table)

        story.append(Spacer(1, 10))

        net_salary = payroll.get("net_salary", 0)

        net_table = Table(
            [
                [
                    Paragraph(
                        "<b>NET SALARY PAYABLE</b>",
                        normal_style,
                    ),
                    Paragraph(
                        f"<b>{self._currency(net_salary)}</b>",
                        right_style,
                    ),
                ]
            ],
            colWidths=[88 * mm, 88 * mm],
        )

        net_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )

        story.append(net_table)

        story.append(
            Spacer(1, 5)
        )

        story.append(
            Paragraph(
                "Amount in Words: Not available",
                normal_style,
            )
        )

        story.append(
            Paragraph(
                "Attendance Summary",
                section_style,
            )
        )

        attendance_rows = [
            ["Working Days", str(attendance["working_days"])],
            ["Present Days", str(attendance["present_days"])],
            ["Paid Leave", str(attendance["paid_leave"])],
            ["Unpaid Leave", str(attendance["unpaid_leave"])],
            ["Holidays", str(attendance["holidays"])],
        ]

        attendance_table = Table(
            attendance_rows,
            colWidths=[75 * mm, 35 * mm],
        )

        attendance_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                    ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )

        story.append(attendance_table)

        story.append(
            Paragraph(
                "Employer Contributions",
                section_style,
            )
        )

        employer_rows = [
            [
                Paragraph(
                    "Employer PF Contribution",
                    normal_style,
                ),
                Paragraph(
                    "Not available",
                    right_style,
                ),
            ],
            [
                Paragraph(
                    "Other Employer Contribution",
                    normal_style,
                ),
                Paragraph(
                    "Not available",
                    right_style,
                ),
            ],
        ]

        employer_table = Table(
            employer_rows,
            colWidths=[88 * mm, 88 * mm],
        )

        employer_table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )

        story.append(employer_table)

        story.append(Spacer(1, 12))

        story.append(
            Paragraph(
                "This is a system-generated payslip and does not require a signature.",
                subtitle_style,
            )
        )

        story.append(
            Spacer(1, 4)
        )

        story.append(
            Paragraph(
                f"Generated On: {self._format_date(date.today())}",
                subtitle_style,
            )
        )

        document.build(story)

        buffer.seek(0)

        return buffer

    @staticmethod
    def _calculate_attendance_summary(
        start_date: date,
        end_date: date,
        attendance_records: list,
        approved_leaves: list,
    ):
        total_days = (end_date - start_date).days + 1

        attendance_by_date = {
            EmployeePayslipService._to_date(record.get("date")): record
            for record in attendance_records
        }

        leave_dates = set()

        for leave in approved_leaves:
            leave_start = EmployeePayslipService._to_date(
                leave.get("start_date")
            )
            leave_end = EmployeePayslipService._to_date(
                leave.get("end_date")
            )

            current = max(leave_start, start_date)
            last = min(leave_end, end_date)

            while current <= last:
                leave_dates.add(current)
                current = current.fromordinal(
                    current.toordinal() + 1
                )

        present_days = 0

        for attendance_date, record in attendance_by_date.items():
            if not (
                start_date <= attendance_date <= end_date
            ):
                continue

            status = str(
                record.get("status", "")
            ).strip().lower()

            if status in {
                "present",
                "late",
            }:
                present_days += 1

        paid_leave = len(leave_dates)

        holidays = 0

        working_days = total_days

        return {
            "working_days": working_days,
            "present_days": present_days,
            "paid_leave": paid_leave,
            "unpaid_leave": 0,
            "holidays": holidays,
        }

    @staticmethod
    def _leave_overlaps_period(
        leave: dict,
        start_date: date,
        end_date: date,
    ) -> bool:
        leave_start = EmployeePayslipService._to_date(
            leave.get("start_date")
        )
        leave_end = EmployeePayslipService._to_date(
            leave.get("end_date")
        )

        return (
            leave_start <= end_date
            and leave_end >= start_date
        )

    @staticmethod
    def _to_date(value):
        if isinstance(value, datetime):
            return value.date()

        if isinstance(value, date):
            return value

        if isinstance(value, str):
            return date.fromisoformat(value)

        raise ValueError(
            f"Unable to convert value to date: {value}"
        )

    @staticmethod
    def _format_date(value):
        if not value:
            return "Not available"

        try:
            converted = EmployeePayslipService._to_date(value)
            return converted.strftime("%d %b %Y")
        except (TypeError, ValueError):
            return "Not available"

    @staticmethod
    def _currency(value):
        try:
            return f"Rs. {float(value):,.2f}"
        except (TypeError, ValueError):
            return "Rs. 0.00"
