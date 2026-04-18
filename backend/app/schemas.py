from datetime import datetime
from pydantic import BaseModel, field_validator
import re


class ProjectCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None

    @field_validator("slug")
    @classmethod
    def slug_must_be_valid(cls, v: str) -> str:
        if not re.match(r"^[a-z0-9-]+$", v):
            raise ValueError("slug may only contain lowercase letters, digits, and hyphens")
        if len(v) < 2 or len(v) > 64:
            raise ValueError("slug must be between 2 and 64 characters")
        return v


class ProjectOut(BaseModel):
    id: str
    slug: str
    name: str
    description: str | None
    created_at: datetime
    event_count: int = 0
    is_public: bool = False

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    is_public: bool


class EventOut(BaseModel):
    id: str
    project_id: str
    source: str | None
    payload: dict
    numeric_fields: dict
    received_at: datetime

    model_config = {"from_attributes": True}


class IngestResponse(BaseModel):
    event_id: str
    project_slug: str
    received_at: datetime


class FieldStat(BaseModel):
    field: str
    min: float
    max: float
    avg: float
    count: int


class ProjectStats(BaseModel):
    total_events: int
    sources: list[str]
    numeric_field_stats: list[FieldStat]
    first_event_at: datetime | None
    last_event_at: datetime | None
