from datetime import datetime

from pydantic import BaseModel, Field


class SessionModel(BaseModel):
    id: str | None = None
    user_id: str
    refresh_token: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_used_at: datetime = Field(default_factory=datetime.utcnow)
    revoked_at: datetime | None = None