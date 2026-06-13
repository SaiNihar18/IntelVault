import asyncio
import json
import logging
import math
import re
import urllib.request
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = logging.getLogger(__name__)


def _cohere_rerank(query: str, documents: list[str], api_key: str, model: str) -> list[dict]:
    url = "https://api.cohere.com/v1/rerank"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "query": query,
        "documents": documents,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data.get("results", [])
    except Exception as e:
        logger.error(f"Cohere Rerank API call failed: {e}")
        return []
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
    document_ids: list[UUID] | None = None,
) -> list[RetrievedChunk]:
    latest_versions_subquery = (
        select(
            DocumentVersion.document_id.label("document_id"),
            func.max(DocumentVersion.version_number).label("version_number"),
        )
        .group_by(DocumentVersion.document_id)
        .subquery()
    )

    conditions = [
        Document.workspace_id == workspace_id,
        Document.status == "ready",
        DocumentVersion.status == "ready",
    ]
    if document_ids:
        conditions.append(Document.id.in_(document_ids))

    result = await session.execute(
        select(
            DocumentChunk.id,
            DocumentChunk.embedding,
            DocumentChunk.content,
            DocumentChunk.chunk_metadata,
            Document.id.label("document_id"),
            Document.filename.label("document_filename"),
            DocumentVersion.version_number.label("version_number"),
        )
        .join(DocumentVersion, DocumentChunk.document_version_id == DocumentVersion.id)
        .join(Document, DocumentChunk.document_id == Document.id)
        .join(
            latest_versions_subquery,
            (latest_versions_subquery.c.document_id == DocumentVersion.document_id)
            & (latest_versions_subquery.c.version_number == DocumentVersion.version_number),
        )
        .where(*conditions)
    )

    rows = result.all()
    if not rows:
        return []

    effective_top_k = top_k if top_k is not None else settings.RETRIEVAL_TOP_K
    effective_min_score = min_score if min_score is not None else settings.RETRIEVAL_MIN_SCORE
    lexical_weight = settings.RETRIEVAL_LEXICAL_WEIGHT

    query_embedding = get_embedding_provider().embed_texts([question])[0]
    query_norm = math.sqrt(sum(a * a for a in query_embedding))
    scored: list[RetrievedChunk] = []

    for chunk_id, embedding, content, chunk_metadata, doc_id, doc_filename, version_number in rows:
        metadata = dict(chunk_metadata or {})
        
        # Inlined cosine similarity using precomputed query norm for speed
        dot = sum(a * b for a, b in zip(query_embedding, embedding))
        right_norm = math.sqrt(sum(b * b for b in embedding))
        similarity = (dot / (query_norm * right_norm)) if (query_norm > 0 and right_norm > 0) else 0.0

        lexical_score = _lexical_overlap_score(question, content)
        hybrid_score = ((1.0 - lexical_weight) * similarity) + (lexical_weight * lexical_score)
        
        if hybrid_score < effective_min_score:
            continue

        page_number = metadata.get("page_number")
        source_type = metadata.get("source_type")
        scored.append(
            RetrievedChunk(
                chunk_id=chunk_id,
                document_id=doc_id,
                document_filename=doc_filename,
                version_number=version_number,
                page_number=int(page_number) if page_number is not None else None,
                source_type=str(source_type) if source_type is not None else None,
                score=hybrid_score,
                vector_score=similarity,
                lexical_score=lexical_score,
                content=content,
                chunk_metadata=metadata,
            )
        )

    scored.sort(key=lambda item: item.score, reverse=True)
    candidates = scored[:20]

    if settings.COHERE_API_KEY and candidates:
        api_key = settings.COHERE_API_KEY
        model = settings.COHERE_RERANK_MODEL
        doc_texts = [c.content for c in candidates]

        results = await asyncio.to_thread(
            _cohere_rerank,
            query=question,
            documents=doc_texts,
            api_key=api_key,
            model=model,
        )

        if results:
            reranked: list[RetrievedChunk] = []
            for res in results:
                idx = res["index"]
                score = res["relevance_score"]
                if 0 <= idx < len(candidates):
                    cand = candidates[idx]
                    cand.score = score
                    reranked.append(cand)

            ranked_ids = {c.chunk_id for c in reranked}
            for cand in candidates:
                if cand.chunk_id not in ranked_ids:
                    cand.score = 0.0
                    reranked.append(cand)

            reranked.sort(key=lambda item: item.score, reverse=True)
            return reranked[:effective_top_k]

    return scored[:effective_top_k]
