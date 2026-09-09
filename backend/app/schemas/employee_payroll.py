from datetime import date, datetime

from pydantic import BaseModel, Field


class SalaryComponentsSchema(BaseModel):
    basic: float = Field(ge=0)
    hra: float = Field(ge=0)
    special_allowance: float = Field(ge=0)
    conveyance: float = Field(ge=0)
    other_allowance: float = Field(ge=0)
    gross: float = Field(ge=0)


class PayrollDeductionsSchema(BaseModel):
    pf: float = Field(ge=0)
    pt: float = Field(ge=0)
    tds: float = Field(ge=0)
    total: float = Field(ge=0)


class BankDetailsSchema(BaseModel):
    bank_name: str
    account_last4: str = Field(
        min_length=4,
        max_length=4,
    )


class PaymentDetailsSchema(BaseModel):
    paid_on: date | None = None
    status: str = "Credited"


class TaxDetailsSchema(BaseModel):
    taxable_income: float = Field(
        default=0,
        ge=0,
    )
    tax_deducted: float = Field(
        default=0,
        ge=0,
    )


class EmployeePayrollResponse(BaseModel):
    id: str
    employee_id: str

    month: str
    pay_period_start: date
    pay_period_end: date

    salary: SalaryComponentsSchema

    deductions: PayrollDeductionsSchema

    net_salary: float

    bank_details: BankDetailsSchema

    payment: PaymentDetailsSchema

    tax_details: TaxDetailsSchema

    created_at: datetime
    updated_at: datetime