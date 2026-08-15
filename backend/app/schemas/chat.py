from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    chat_session_id: UUID | None = None
    debug_retrieval: bool = False
    document_ids: list[UUID] | None = None


class ChatSourcePublic(BaseModel):
    chunk_id: UUID
    document_id: UUID
    document_filename: str
    version_number: int
    page_number: int | None = None
    source_type: str | None = None
    score: float
    content: str


class ChatResponse(BaseModel):
    chat_session_id: UUID
    user_message_id: UUID
    assistant_message_id: UUID
    answer: str
    sources: list[ChatSourcePublic]
    retrieval_debug: dict[str, object] | None = None


class ChatSessionPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    created_by_user_id: UUID
    title: str
    created_at: datetime
    updated_at: datetime


class ChatMessagePublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    chat_session_id: UUID
    role: str
    content: str
    sources: list[dict[str, object]] | None
    created_at: datetime


class ChatSessionListResponse(BaseModel):
    sessions: list[ChatSessionPublic]


class ChatMessageListResponse(BaseModel):
    chat_session_id: UUID
    messages: list[ChatMessagePublic]


class ChatSessionUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=255)

