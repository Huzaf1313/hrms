from pydantic import BaseModel, Field


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = None


class DepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    description: str | None = None