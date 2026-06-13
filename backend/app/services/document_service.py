from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
from uuid import UUID

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import IntelVaultError
from app.core import storage
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

    sha256 = hashlib.sha256()
    file_size = 0
    tmp_dir = Path(settings.FILE_STORAGE_ROOT) / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = tmp_dir / f"{uuid.uuid4()}.tmp"

    try:
        with open(tmp_path, "wb") as f:
            while True:
                chunk = await file.read(65536)
                if not chunk:
                    break
                f.write(chunk)
                sha256.update(chunk)
                file_size += len(chunk)

        if file_size == 0:
            raise InvalidDocumentUploadError("Uploaded file is empty")

        checksum = sha256.hexdigest()
    except Exception:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
        raise

    try:
        document = Document(
            workspace_id=workspace_id,
            uploaded_by_user_id=current_user.id,
            filename=filename,
            content_type=file.content_type,
            file_size_bytes=file_size,
            storage_path="",
            checksum_sha256=checksum,
            status="processing",
        )
        session.add(document)
        await session.flush()

        # Build a portable relative key for the storage manager.
        relative_key = f"workspaces/{workspace_id}/documents/{document.id}/{filename}"

        # Read the temp file bytes and store via the unified storage layer.
        file_bytes = tmp_path.read_bytes()
        stored_path = storage.store_file(relative_key, file_bytes)

        document.storage_path = stored_path
        await session.commit()
        await session.refresh(document)
        return document
    except Exception:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
        raise
    finally:
        # Clean up the local temp file after successful upload.
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass
        await file.close()


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


async def delete_workspace_document(
    session: AsyncSession,
    workspace_id: UUID,
    document_id: UUID,
) -> None:
    document = await get_workspace_document(session, workspace_id, document_id)
    if document.storage_path:
        storage.delete_file(document.storage_path)
    await session.delete(document)
    await session.commit()
