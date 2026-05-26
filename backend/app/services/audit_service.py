from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_event import AuditEvent


async def log_event(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    event_type: str,
    actor_user_id: UUID | None = None,
    document_id: UUID | None = None,
    chat_session_id: UUID | None = None,
    event_metadata: dict[str, object] | None = None,
) -> AuditEvent:
    event = AuditEvent(
        workspace_id=workspace_id,
        event_type=event_type,
        actor_user_id=actor_user_id,
        document_id=document_id,
        chat_session_id=chat_session_id,
        event_metadata=event_metadata or {},
    )
    session.add(event)
    await session.flush()
    return event


async def list_workspace_events(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    limit: int = 100,
) -> list[AuditEvent]:
    safe_limit = max(1, min(limit, 500))
    result = await session.execute(
        select(AuditEvent)
        .where(AuditEvent.workspace_id == workspace_id)
        .order_by(AuditEvent.created_at.desc())
        .limit(safe_limit)
    )
    return list(result.scalars().all())
