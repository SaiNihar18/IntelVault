from __future__ import annotations

import hashlib
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import IntelVaultError
from app.models.document import Document
from app.models.user import User


class DocumentNotFoundError(IntelVaultError):
    def __init__(self) -> None:
        super().__init__("Document not found", status_code=404)


class InvalidDocumentUploadError(IntelVaultError):
    def __init__(self, message: str) -> None:
        super().__init__(message, status_code=400)


def _sanitize_filename(name: str) -> str:
    clean = Path(name).name.strip()
    if not clean:
        raise InvalidDocumentUploadError("Filename is required")
    if len(clean) > 260:
        raise InvalidDocumentUploadError("Filename is too long")
    return clean


async def upload_document(
    session: AsyncSession,
    workspace_id: UUID,
    current_user: User,
    file: UploadFile,
) -> Document:
    filename = _sanitize_filename(file.filename or "")
    payload = await file.read()
    if not payload:
        raise InvalidDocumentUploadError("Uploaded file is empty")

    checksum = hashlib.sha256(payload).hexdigest()

    document = Document(
        workspace_id=workspace_id,
        uploaded_by_user_id=current_user.id,
        filename=filename,
        content_type=file.content_type,
        file_size_bytes=len(payload),
        storage_path="",
        checksum_sha256=checksum,
        status="processing",
    )
    session.add(document)
    await session.flush()

    storage_root = Path(settings.FILE_STORAGE_ROOT)
    target_dir = storage_root / "workspaces" / str(workspace_id) / "documents" / str(document.id)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    target_path.write_bytes(payload)

    document.storage_path = str(target_path)
    await session.commit()
    await session.refresh(document)
    await file.close()
    return document


async def list_workspace_documents(
    session: AsyncSession,
    workspace_id: UUID,
) -> list[Document]:
    result = await session.execute(
        select(Document)
        .where(Document.workspace_id == workspace_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def get_workspace_document(
    session: AsyncSession,
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
