from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db, require_workspace_permission
from app.core.permissions import Permission
from app.models.user import User
from app.models.workspace_membership import WorkspaceMembership
from app.schemas.chat import (
    ChatAskRequest,
    ChatMessageListResponse,
    ChatMessagePublic,
    ChatResponse,
    ChatSessionListResponse,
    ChatSessionPublic,
    ChatSessionUpdate,
)
from app.services import chat_service

router = APIRouter(prefix="/workspaces/{workspace_id}/chat", tags=["chat"])


@router.get("/sessions", response_model=ChatSessionListResponse)
async def list_sessions(
    workspace_id: UUID,
    limit: int = 20,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_ask)),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionListResponse:
    sessions = await chat_service.list_chat_sessions(
        session,
        workspace_id=workspace_id,
        user_id=current_user.id,
        limit=limit,
    )
    return ChatSessionListResponse(sessions=[ChatSessionPublic.model_validate(item) for item in sessions])


@router.get("/sessions/{chat_session_id}/messages", response_model=ChatMessageListResponse)
async def list_messages(
    workspace_id: UUID,
    chat_session_id: UUID,
    limit: int = 100,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_ask)),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatMessageListResponse:
    messages = await chat_service.list_chat_messages(
        session,
        workspace_id=workspace_id,
        chat_session_id=chat_session_id,
        user_id=current_user.id,
        limit=limit,
    )
    return ChatMessageListResponse(
        chat_session_id=chat_session_id,
        messages=[ChatMessagePublic.model_validate(item) for item in messages],
    )


@router.post("/messages", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def ask_chat(
    workspace_id: UUID,
    body: ChatAskRequest,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_ask)),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatResponse:
    result = await chat_service.ask_question(
        session,
        workspace_id=workspace_id,
        user=current_user,
        question=body.question,
        chat_session_id=body.chat_session_id,
        debug_retrieval=body.debug_retrieval,
        document_ids=body.document_ids,
    )
    return ChatResponse(
        chat_session_id=result.chat_session.id,
        user_message_id=result.user_message.id,
        assistant_message_id=result.assistant_message.id,
        answer=result.answer,
        sources=[
            {
                "chunk_id": source.chunk_id,
                "document_id": source.document_id,
                "document_filename": source.document_filename,
                "version_number": source.version_number,
                "page_number": source.page_number,
                "source_type": source.source_type,
                "score": source.score,
                "content": source.content,
            }
            for source in result.sources
        ],
        retrieval_debug=result.retrieval_debug,
    )


@router.patch("/sessions/{chat_session_id}", response_model=ChatSessionPublic)
async def rename_session(
    workspace_id: UUID,
    chat_session_id: UUID,
    body: ChatSessionUpdate,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_ask)),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionPublic:
    updated = await chat_service.rename_chat_session(
        session,
        workspace_id=workspace_id,
        chat_session_id=chat_session_id,
        user_id=current_user.id,
        title=body.title,
    )
    return ChatSessionPublic.model_validate(updated)


@router.delete("/sessions/{chat_session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    workspace_id: UUID,
    chat_session_id: UUID,
    _: WorkspaceMembership = Depends(require_workspace_permission(Permission.document_ask)),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await chat_service.delete_chat_session(
        session,
        workspace_id=workspace_id,
        chat_session_id=chat_session_id,
        user_id=current_user.id,
    )

