from datetime import datetime

from pydantic import BaseModel, Field


class DepartmentModel(BaseModel):
    id: str | None = None
    name: str
    description: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)