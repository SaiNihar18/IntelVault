from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import IntelVaultError
from app.models.chat_message import ChatMessage
from app.models.chat_session import ChatSession
from app.models.user import User
from app.models.workspace import Workspace
from app.models.document import Document
from app.services import audit_service
from app.services.llm_service import get_chat_completion_provider
from app.services.retrieval_service import RetrievedChunk, retrieve_relevant_chunks


class ChatSessionNotFoundError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Chat session not found", status_code=404)


@dataclass(slots=True)
class ChatTurnResult:
    chat_session: ChatSession
    user_message: ChatMessage
    assistant_message: ChatMessage
    sources: list[RetrievedChunk]
    answer: str
    retrieval_debug: dict[str, object] | None


async def _get_chat_session(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    chat_session_id: UUID,
    user_id: UUID,
) -> ChatSession:
    result = await session.execute(
        select(ChatSession).where(
            ChatSession.id == chat_session_id,
            ChatSession.workspace_id == workspace_id,
            ChatSession.created_by_user_id == user_id,
        )
    )
    chat_session = result.scalar_one_or_none()
    if chat_session is None:
        raise ChatSessionNotFoundError()
    return chat_session


async def _create_chat_session(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    user: User,
    title: str,
) -> ChatSession:
    chat_session = ChatSession(
        workspace_id=workspace_id,
        created_by_user_id=user.id,
        title=title[:200],
    )
    session.add(chat_session)
    await session.flush()
    return chat_session


async def ask_question(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    user: User,
    question: str,
    chat_session_id: UUID | None = None,
    debug_retrieval: bool = False,
    document_ids: list[UUID] | None = None,
) -> ChatTurnResult:
    if chat_session_id is None:
        chat_session = await _create_chat_session(session, workspace_id=workspace_id, user=user, title=question)
    else:
        chat_session = await _get_chat_session(
            session,
            workspace_id=workspace_id,
            chat_session_id=chat_session_id,
            user_id=user.id,
        )

    user_message = ChatMessage(
        chat_session_id=chat_session.id,
        role="user",
        content=question,
        sources=None,
    )
    session.add(user_message)
    await session.flush()

    # Fetch workspace metadata
    workspace_result = await session.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    db_workspace = workspace_result.scalar_one_or_none()
    workspace_name = db_workspace.name if db_workspace else "Unknown"

    doc_count_result = await session.execute(
        select(func.count(Document.id)).where(Document.workspace_id == workspace_id)
    )
    document_count = doc_count_result.scalar() or 0

    # Greeting detection to skip retrieval entirely
    clean_q = question.lower().strip().rstrip("?.!")
    is_greeting = clean_q in {
        "hi", "hello", "hey", "hey there", "yo", "greetings", 
        "good morning", "good afternoon", "good evening"
    }

    if is_greeting:
        sources = []
        context_blocks = []
    else:
        sources = await retrieve_relevant_chunks(
            session,
            workspace_id=workspace_id,
            question=question,
            top_k=settings.RETRIEVAL_TOP_K,
            min_score=settings.RETRIEVAL_MIN_SCORE,
            document_ids=document_ids,
        )
        context_blocks = [
            f"Document: {source.document_filename}\nPage: {source.page_number or 'n/a'}\nContent: {source.content}"
            for source in sources
        ]

    answer = get_chat_completion_provider().generate_answer(
        question, 
        context_blocks,
        workspace_name=workspace_name,
        document_count=document_count
    )

    # Post-process response to clear citations if answered out-of-context or is greeting
    if "[no_context_used]" in answer.lower():
        sources = []
        import re
        answer = re.sub(r"\[NO_CONTEXT_USED\]", "", answer, flags=re.IGNORECASE).strip()
    
    if "not available within the current workspace documents" in answer.lower():
        sources = []

    retrieval_debug: dict[str, object] | None = None
    if debug_retrieval:
        retrieval_debug = {
            "top_k": settings.RETRIEVAL_TOP_K,
            "min_score": settings.RETRIEVAL_MIN_SCORE,
            "lexical_weight": settings.RETRIEVAL_LEXICAL_WEIGHT,
            "selected_count": len(sources),
            "selected": [
                {
                    "chunk_id": str(source.chunk_id),
                    "document_id": str(source.document_id),
                    "score": source.score,
                    "vector_score": source.vector_score,
                    "lexical_score": source.lexical_score,
                }
                for source in sources
            ],
        }

    assistant_message = ChatMessage(
        chat_session_id=chat_session.id,
        role="assistant",
        content=answer,
        sources=[
            {
                "chunk_id": str(source.chunk_id),
                "document_id": str(source.document_id),
                "document_filename": source.document_filename,
                "version_number": source.version_number,
                "page_number": source.page_number,
                "source_type": source.source_type,
                "score": source.score,
            }
            for source in sources
        ],
    )
    session.add(assistant_message)
    await audit_service.log_event(
        session,
        workspace_id=workspace_id,
        event_type="chat.question_asked",
        actor_user_id=user.id,
        chat_session_id=chat_session.id,
        event_metadata={
            "sources_count": len(sources),
        },
    )
    await session.commit()
    await session.refresh(chat_session)
    await session.refresh(user_message)
    await session.refresh(assistant_message)

    return ChatTurnResult(
        chat_session=chat_session,
        user_message=user_message,
        assistant_message=assistant_message,
        sources=sources,
        answer=answer,
        retrieval_debug=retrieval_debug,
    )


async def list_chat_sessions(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    user_id: UUID,
    limit: int = 20,
) -> list[ChatSession]:
    safe_limit = max(1, min(limit, 100))
    result = await session.execute(
        select(ChatSession)
        .where(
            ChatSession.workspace_id == workspace_id,
            ChatSession.created_by_user_id == user_id,
        )
        .order_by(ChatSession.updated_at.desc())
        .limit(safe_limit)
    )
    return list(result.scalars().all())


async def list_chat_messages(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    chat_session_id: UUID,
    user_id: UUID,
    limit: int = 100,
) -> list[ChatMessage]:
    chat_session = await _get_chat_session(
        session,
        workspace_id=workspace_id,
        chat_session_id=chat_session_id,
        user_id=user_id,
    )
    safe_limit = max(1, min(limit, 500))
    result = await session.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_session_id == chat_session.id)
        .order_by(ChatMessage.created_at.asc())
        .limit(safe_limit)
    )
    return list(result.scalars().all())
