from typing import Literal

from pydantic import BaseModel, Field


class AdminDeductionCreate(BaseModel):
    name: str = Field(min_length=1)
    code: str = Field(min_length=1)
    type: Literal["deduction", "contribution"]
    calculation_method: Literal[
        "percentage_of_basic",
        "fixed_amount",
        "slab_based",
        "tax_calculation",
    ]
    percentage: float | None = Field(default=None, ge=0, le=100)
    fixed_amount: float | None = Field(default=None, ge=0)
    description: str | None = None
    is_active: bool = True


class AdminDeductionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    code: str | None = Field(default=None, min_length=1)
    type: Literal["deduction", "contribution"] | None = None
    calculation_method: Literal[
        "percentage_of_basic",
        "fixed_amount",
        "slab_based",
        "tax_calculation",
    ] | None = None
    percentage: float | None = Field(default=None, ge=0, le=100)
    fixed_amount: float | None = Field(default=None, ge=0)
    description: str | None = None
    is_active: bool | None = None


class AdminDeductionResponse(BaseModel):
    id: str
    name: str
    code: str
    type: Literal["deduction", "contribution"]
    calculation_method: Literal[
        "percentage_of_basic",
        "fixed_amount",
        "slab_based",
        "tax_calculation",
    ]
    percentage: float | None = None
    fixed_amount: float | None = None
    description: str | None = None
    is_active: bool


class ApplyDeductionRequest(BaseModel):
    salary_structure_ids: list[str] = Field(default_factory=list)
    structure_ids: list[str] | None = None

    def get_structure_ids(self) -> list[str]:
        return self.salary_structure_ids or self.structure_ids or []


class DeductionCalculationRequest(BaseModel):
    basic_salary: float = Field(ge=0)
    annual_income: float = Field(ge=0)


class DeductionCalculationResult(BaseModel):
    id: str
    name: str
    code: str
    type: Literal["deduction", "contribution"]
    calculated_amount: float


class DeductionCalculationResponse(BaseModel):
    basic_salary: float
    annual_income: float
    results: list[DeductionCalculationResult]
    total_deductions: float
    total_contributions: float