from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.document import DocumentPublic


class ShareLinkCreateRequest(BaseModel):
    expires_in_hours: int = Field(default=24, ge=1, le=24 * 30)
    max_uses: int | None = Field(default=None, ge=1, le=10000)


class ShareLinkPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    document_id: UUID
    created_by_user_id: UUID
    expires_at: datetime
    max_uses: int | None
    use_count: int
    is_revoked: bool
    created_at: datetime
    last_used_at: datetime | None


class ShareLinkCreateResponse(BaseModel):
    link: ShareLinkPublic
    share_token: str
    share_url: str


class ShareLinkListResponse(BaseModel):
    links: list[ShareLinkPublic]


class SharedDocumentAccessResponse(BaseModel):
    document: DocumentPublic
