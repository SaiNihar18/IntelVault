from __future__ import annotations

import asyncio
import logging
from uuid import UUID

from sqlalchemy import func, select

from app.core.config import settings
from app.core import storage
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.document_version import DocumentVersion
from app.services.chunking_service import chunk_segments
from app.services.embedding_service import get_embedding_provider
from app.services.parser_service import parse_document
from app.db.session import async_session_maker

logger = logging.getLogger(__name__)


async def process_document(document_id: UUID) -> None:
    async with async_session_maker() as session:
        result = await session.execute(select(Document).where(Document.id == document_id))
        document = result.scalar_one_or_none()
        if document is None:
            logger.warning("document_processing_missing_document", extra={"document_id": str(document_id)})
            return

        if document.status not in {"processing", "uploaded"}:
            logger.info(
                "document_processing_skipped",
                extra={"document_id": str(document_id), "status": document.status},
            )
            return

        if document.status != "processing":
            document.status = "processing"
            await session.commit()

        try:
            logger.info("document_processing_started", extra={"document_id": str(document.id)})

            # Load file bytes from the storage layer (Supabase or local).
            file_bytes = await asyncio.to_thread(storage.read_file, document.storage_path)

            parsed = await asyncio.to_thread(
                parse_document,
                file_path=document.storage_path,
                filename=document.filename,
                file_bytes=file_bytes,
            )
            candidates = chunk_segments(
                [
                    {"text": seg.text, "metadata": seg.metadata}
                    for seg in parsed.segments
                ],
                chunk_size=settings.CHUNK_SIZE_CHARS,
                overlap=settings.CHUNK_OVERLAP_CHARS,
            )
            if not candidates:
                raise ValueError("No readable text found in document")

            max_version_result = await session.execute(
                select(func.max(DocumentVersion.version_number)).where(
                    DocumentVersion.document_id == document.id
                )
            )
            current_max = max_version_result.scalar_one_or_none() or 0
            version = DocumentVersion(
                document_id=document.id,
                version_number=int(current_max) + 1,
                status="ready",
                source_storage_path=document.storage_path,
                extracted_text=parsed.full_text,
                extraction_metadata=parsed.metadata,
            )
            session.add(version)
            await session.flush()

            embeddings = await asyncio.to_thread(
                get_embedding_provider().embed_texts,
                [candidate.content for candidate in candidates]
            )
            for idx, (candidate, embedding) in enumerate(zip(candidates, embeddings)):
                session.add(
                    DocumentChunk(
                        document_id=document.id,
                        document_version_id=version.id,
                        chunk_index=idx,
                        content=candidate.content,
                        embedding=embedding,
                        chunk_metadata=candidate.metadata,
                    )
                )

            document.status = "ready"
            await session.commit()
            logger.info(
                "document_processing_completed",
                extra={"document_id": str(document.id), "chunks": len(candidates)},
            )
        except Exception as exc:
            logger.exception(
                "document_processing_failed",
                extra={"document_id": str(document_id), "error": str(exc)},
            )
            import traceback
            error_msg = f"{type(exc).__name__}: {str(exc)}\n{traceback.format_exc()}"
            try:
                await session.rollback()
                failed_doc = await session.get(Document, document_id)
                if failed_doc is not None:
                    failed_doc.status = "failed"
                    failed_doc.error_message = error_msg
                    await session.commit()
            except Exception as db_exc:
                logger.exception(
                    "document_processing_failed_error_persistence_failed",
                    extra={"document_id": str(document_id), "error": str(db_exc)},
                )
