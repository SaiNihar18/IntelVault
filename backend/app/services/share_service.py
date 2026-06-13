from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import ShareLinkInvalidError, ShareLinkNotFoundError, SharedDocumentFileNotFoundError
from app.models.document import Document
from app.models.document_share_link import DocumentShareLink
from app.models.user import User
from app.services import audit_service
from app.services.document_service import DocumentNotFoundError


def _hash_share_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _generate_share_token() -> str:
    return secrets.token_urlsafe(32)


async def _get_workspace_document(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    document_id: UUID,
) -> Document:
    result = await session.execute(
        select(Document).where(
            Document.id == document_id,
            Document.workspace_id == workspace_id,
        )
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise DocumentNotFoundError()
    return document


async def create_share_link(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    document_id: UUID,
    current_user: User,
    expires_in_hours: int,
    max_uses: int | None,
) -> tuple[DocumentShareLink, str, str]:
    document = await _get_workspace_document(
        session,
        workspace_id=workspace_id,
        document_id=document_id,
    )

    share_token = _generate_share_token()
    token_hash = _hash_share_token(share_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

    link = DocumentShareLink(
        workspace_id=workspace_id,
        document_id=document.id,
        created_by_user_id=current_user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        max_uses=max_uses,
        use_count=0,
        is_revoked=False,
    )
    session.add(link)
    await session.flush()

    await audit_service.log_event(
        session,
        workspace_id=workspace_id,
        event_type="share_link.created",
        actor_user_id=current_user.id,
        document_id=document.id,
        event_metadata={
            "share_link_id": str(link.id),
            "expires_at": expires_at.isoformat(),
            "max_uses": max_uses,
        },
    )

    await session.commit()
    await session.refresh(link)
    share_url = f"{settings.PUBLIC_API_BASE_URL.rstrip('/')}/api/v1/shares/{share_token}"
    return link, share_token, share_url


async def list_document_share_links(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    document_id: UUID,
    limit: int = 100,
) -> list[DocumentShareLink]:
    await _get_workspace_document(session, workspace_id=workspace_id, document_id=document_id)
    safe_limit = max(1, min(limit, 500))
    result = await session.execute(
        select(DocumentShareLink)
        .where(
            DocumentShareLink.workspace_id == workspace_id,
            DocumentShareLink.document_id == document_id,
        )
        .order_by(DocumentShareLink.created_at.desc())
        .limit(safe_limit)
    )
    return list(result.scalars().all())


async def revoke_share_link(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    document_id: UUID,
    share_link_id: UUID,
    current_user: User,
) -> DocumentShareLink:
    result = await session.execute(
        select(DocumentShareLink).where(
            DocumentShareLink.id == share_link_id,
            DocumentShareLink.workspace_id == workspace_id,
            DocumentShareLink.document_id == document_id,
        )
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise ShareLinkNotFoundError()

    link.is_revoked = True
    await audit_service.log_event(
        session,
        workspace_id=workspace_id,
        event_type="share_link.revoked",
        actor_user_id=current_user.id,
        document_id=document_id,
        event_metadata={"share_link_id": str(link.id)},
    )
    await session.commit()
    await session.refresh(link)
    return link


async def resolve_share_token(
    session: AsyncSession,
    *,
    share_token: str,
    increment_uses: bool = True,
    access_event_type: str = "share_link.accessed",
) -> Document:
    token_hash = _hash_share_token(share_token)
    result = await session.execute(
        select(DocumentShareLink)
        .where(DocumentShareLink.token_hash == token_hash)
    )
    link = result.scalar_one_or_none()
    if link is None:
        raise ShareLinkNotFoundError()

    now = datetime.now(timezone.utc)
    if link.is_revoked or link.expires_at <= now:
        raise ShareLinkInvalidError()
    if link.max_uses is not None and link.use_count >= link.max_uses:
        raise ShareLinkInvalidError()

    result = await session.execute(
        select(Document).where(Document.id == link.document_id)
    )
    document = result.scalar_one_or_none()
    if document is None:
        raise DocumentNotFoundError()

    if increment_uses:
        link.use_count += 1
        link.last_used_at = now
        await audit_service.log_event(
            session,
            workspace_id=link.workspace_id,
            event_type=access_event_type,
            actor_user_id=None,
            document_id=link.document_id,
            event_metadata={
                "share_link_id": str(link.id),
                "use_count": link.use_count,
            },
        )
        await session.commit()
    return document


async def resolve_share_token_for_download(
    session: AsyncSession,
    *,
    share_token: str,
) -> tuple[Document, Path]:
    document = await resolve_share_token(
        session,
        share_token=share_token,
        access_event_type="share_link.downloaded",
    )
    file_path = Path(document.storage_path)
    if not file_path.is_file():
        raise SharedDocumentFileNotFoundError()
    return document, file_path
