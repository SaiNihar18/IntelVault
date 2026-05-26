from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod

from app.core.config import settings


class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        raise NotImplementedError


class DeterministicEmbeddingProvider(EmbeddingProvider):
    """Deterministic local embeddings for MVP until external providers are wired."""

    def __init__(self, dimension: int) -> None:
        self.dimension = dimension

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]

    def _embed_one(self, text: str) -> list[float]:
        seed = hashlib.sha256(text.encode("utf-8")).digest()
        buf = bytearray(seed)
        while len(buf) < self.dimension * 2:
            buf.extend(hashlib.sha256(bytes(buf)).digest())

        out: list[float] = []
        for i in range(self.dimension):
            raw = int.from_bytes(buf[i * 2 : i * 2 + 2], byteorder="big", signed=False)
            out.append((raw / 32767.5) - 1.0)
        return out


def get_embedding_provider() -> EmbeddingProvider:
    return DeterministicEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)
