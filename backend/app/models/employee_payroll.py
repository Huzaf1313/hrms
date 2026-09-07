from datetime import date, datetime, timezone

from pydantic import BaseModel, Field


class SalaryComponents(BaseModel):
    basic: float = Field(ge=0)
    hra: float = Field(ge=0)
    special_allowance: float = Field(ge=0)
    conveyance: float = Field(ge=0)
    other_allowance: float = Field(ge=0)
    gross: float = Field(ge=0)


class PayrollDeductions(BaseModel):
    pf: float = Field(ge=0)
    pt: float = Field(ge=0)
    tds: float = Field(ge=0)
    total: float = Field(ge=0)


class BankDetails(BaseModel):
    bank_name: str
    account_last4: str = Field(
        min_length=4,
        max_length=4,
    )


class PaymentDetails(BaseModel):
    paid_on: date | None = None
    status: str = "Credited"


class TaxDetails(BaseModel):
    taxable_income: float = Field(
        default=0,
        ge=0,
    )
    tax_deducted: float = Field(
        default=0,
        ge=0,
    )


class EmployeePayrollModel(BaseModel):
    id: str | None = None

    employee_id: str

    month: str
    pay_period_start: date
    pay_period_end: date

    salary: SalaryComponents

    deductions: PayrollDeductions

    net_salary: float = Field(ge=0)

    bank_details: BankDetails

    payment: PaymentDetails

    tax_details: TaxDetails

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )