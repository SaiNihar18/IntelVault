from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditEventPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    event_type: str
    actor_user_id: UUID | None
    actor_email: str | None = None
    document_id: UUID | None
    chat_session_id: UUID | None
    event_metadata: dict[str, object]
    created_at: datetime


class AuditEventListResponse(BaseModel):
    events: list[AuditEventPublic]
