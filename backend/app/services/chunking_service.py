from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ChunkCandidate:
    content: str
    metadata: dict[str, object]


def chunk_text(text: str, *, chunk_size: int, overlap: int) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []

    if overlap >= chunk_size:
        overlap = max(0, chunk_size // 4)

    chunks: list[str] = []
    step = max(1, chunk_size - overlap)
    start = 0
    length = len(cleaned)

    while start < length:
        end = min(length, start + chunk_size)
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start += step

    return chunks


def chunk_segments(
    segments: list[dict[str, object]],
    *,
    chunk_size: int,
    overlap: int,
) -> list[ChunkCandidate]:
    out: list[ChunkCandidate] = []
    for segment in segments:
        text = str(segment.get("text", "")).strip()
        if not text:
            continue

        segment_meta = dict(segment.get("metadata", {}))
        text_chunks = chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        for piece_index, piece in enumerate(text_chunks):
            out.append(
                ChunkCandidate(
                    content=piece,
                    metadata={
                        **segment_meta,
                        "segment_chunk_index": piece_index,
                    },
                )
            )
    return out
