from datetime import date, datetime

from pydantic import BaseModel, Field


class AdminPayslipCreate(BaseModel):
    employee_id: str = Field(min_length=1)
    month: str = Field(min_length=1)
    year: int = Field(ge=2000, le=2100)


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

    