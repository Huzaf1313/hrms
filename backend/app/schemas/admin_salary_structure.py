from pydantic import BaseModel, Field


class Earning(BaseModel):
    label: str
    amount: float = Field(ge=0)


class AdminSalaryStructureCreate(BaseModel):
    name: str = Field(min_length=1)
    range: str = Field(min_length=1)
    earnings: list[Earning] = Field(min_length=1)


class AdminSalaryStructureUpdate(BaseModel):
    name: str | None = None
    range: str | None = None
    earnings: list[Earning] | None = None


class AppliedDeduction(BaseModel):
    id: str
    name: str
    type: str
    calculation_method: str
    percentage: float | None = None
    fixed_amount: float | None = None


class AdminSalaryStructureResponse(BaseModel):
    id: str
    name: str
    range: str
    earnings: list[Earning]
    gross_salary: float
    deductions: list[AppliedDeduction] = Field(default_factory=list)
