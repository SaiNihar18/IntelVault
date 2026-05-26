from __future__ import annotations

import math
import re
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.document_version import DocumentVersion
from app.services.embedding_service import get_embedding_provider


@dataclass(slots=True)
class RetrievedChunk:
    chunk_id: UUID
    document_id: UUID
    document_filename: str
    version_number: int
    page_number: int | None
    source_type: str | None
    score: float
    vector_score: float
    lexical_score: float
    content: str
    chunk_metadata: dict[str, object]


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(a * a for a in left))
    right_norm = math.sqrt(sum(b * b for b in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _lexical_overlap_score(query: str, content: str) -> float:
    query_tokens = _tokenize(query)
    if not query_tokens:
        return 0.0
    content_tokens = _tokenize(content)
    if not content_tokens:
        return 0.0
    shared = len(query_tokens.intersection(content_tokens))
    return shared / len(query_tokens)


async def retrieve_relevant_chunks(
    session: AsyncSession,
    *,
    workspace_id: UUID,
    question: str,
    top_k: int | None = None,
    min_score: float | None = None,
) -> list[RetrievedChunk]:
    latest_versions_subquery = (
        select(
            DocumentVersion.document_id.label("document_id"),
            func.max(DocumentVersion.version_number).label("version_number"),
        )
        .group_by(DocumentVersion.document_id)
        .subquery()
    )

    result = await session.execute(
        select(DocumentChunk, Document, DocumentVersion)
        .join(DocumentVersion, DocumentChunk.document_version_id == DocumentVersion.id)
        .join(Document, DocumentChunk.document_id == Document.id)
        .join(
            latest_versions_subquery,
            (latest_versions_subquery.c.document_id == DocumentVersion.document_id)
            & (latest_versions_subquery.c.version_number == DocumentVersion.version_number),
        )
        .where(
            Document.workspace_id == workspace_id,
            Document.status == "ready",
            DocumentVersion.status == "ready",
        )
    )

    rows = result.all()
    if not rows:
        return []

    effective_top_k = top_k if top_k is not None else settings.RETRIEVAL_TOP_K
    effective_min_score = min_score if min_score is not None else settings.RETRIEVAL_MIN_SCORE
    lexical_weight = settings.RETRIEVAL_LEXICAL_WEIGHT

    query_embedding = get_embedding_provider().embed_texts([question])[0]
    scored: list[RetrievedChunk] = []
    for chunk, document, version in rows:
        chunk_metadata = dict(chunk.chunk_metadata or {})
        similarity = _cosine_similarity(query_embedding, list(chunk.embedding))
        lexical_score = _lexical_overlap_score(question, chunk.content)
        hybrid_score = ((1.0 - lexical_weight) * similarity) + (lexical_weight * lexical_score)
        page_number = chunk_metadata.get("page_number")
        source_type = chunk_metadata.get("source_type")
        if hybrid_score < effective_min_score:
            continue
        scored.append(
            RetrievedChunk(
                chunk_id=chunk.id,
                document_id=document.id,
                document_filename=document.filename,
                version_number=version.version_number,
                page_number=int(page_number) if page_number is not None else None,
                source_type=str(source_type) if source_type is not None else None,
                score=hybrid_score,
                vector_score=similarity,
                lexical_score=lexical_score,
                content=chunk.content,
                chunk_metadata=chunk_metadata,
            )
        )

    scored.sort(key=lambda item: item.score, reverse=True)
    return scored[:effective_top_k]
