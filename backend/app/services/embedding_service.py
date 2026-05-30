from __future__ import annotations

import hashlib
import json
import logging
import time
from abc import ABC, abstractmethod
from urllib import error, request

from app.core.config import settings

logger = logging.getLogger(__name__)


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


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Real semantic embeddings using Gemini's gemini-embedding-2 model."""

    def __init__(self, api_key: str, base_url: str, dimension: int) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.dimension = dimension
        self.fallback = DeterministicEmbeddingProvider(dimension)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        
        batch_size = 50
        all_embeddings: list[list[float]] = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            try:
                embeddings = self._embed_batch(batch)
                all_embeddings.extend(embeddings)
            except Exception as e:
                logger.warning(f"Batch embedding failed: {e}. Falling back to sequential embedding.")
                for text in batch:
                    all_embeddings.append(self._embed_one(text))
                    
        return all_embeddings

    def _embed_batch(self, batch: list[str]) -> list[list[float]]:
        payload = {
            "requests": [
                {
                    "model": "models/gemini-embedding-2",
                    "content": {
                        "parts": [{"text": text}]
                    },
                    "outputDimensionality": self.dimension
                }
                for text in batch
            ]
        }
        data = json.dumps(payload).encode("utf-8")
        url = f"{self.base_url}/models/gemini-embedding-2:batchEmbedContents?key={self.api_key}"
        req = request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        max_attempts = max(1, settings.GEMINI_MAX_RETRIES + 1)

        for attempt in range(max_attempts):
            try:
                with request.urlopen(req, timeout=settings.GEMINI_REQUEST_TIMEOUT_SECONDS) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                break
            except error.HTTPError as exc:
                if exc.code == 429 or exc.code >= 500:
                    if attempt >= max_attempts - 1:
                        raise exc
                    retry_after = exc.headers.get("Retry-After")
                    try:
                        delay = max(0.1, float(retry_after)) if retry_after else settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                    except (ValueError, TypeError):
                        delay = settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                    time.sleep(delay)
                    continue
                else:
                    raise exc
            except Exception as exc:
                if attempt >= max_attempts - 1:
                    raise exc
                time.sleep(settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt))
                continue
        else:
            raise RuntimeError("Batch embedding request failed after retries")

        embeddings_list = body.get("embeddings") or []
        if len(embeddings_list) != len(batch):
            raise ValueError(f"Expected {len(batch)} embeddings, got {len(embeddings_list)}")
            
        results: list[list[float]] = []
        for emb in embeddings_list:
            values = emb.get("values")
            if not values or len(values) != self.dimension:
                raise ValueError("Invalid embedding dimension or values in batch response")
            results.append([float(v) for v in values])
            
        return results

    def _embed_one(self, text: str) -> list[float]:
        payload = {
            "model": "models/gemini-embedding-2",
            "content": {
                "parts": [{"text": text}]
            },
            "outputDimensionality": self.dimension
        }
        data = json.dumps(payload).encode("utf-8")
        url = f"{self.base_url}/models/gemini-embedding-2:embedContent?key={self.api_key}"
        req = request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        max_attempts = max(1, settings.GEMINI_MAX_RETRIES + 1)

        for attempt in range(max_attempts):
            try:
                with request.urlopen(req, timeout=settings.GEMINI_REQUEST_TIMEOUT_SECONDS) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                break
            except error.HTTPError as exc:
                # 429 (Rate limit) and >=500 are retryable
                if exc.code == 429 or exc.code >= 500:
                    if attempt >= max_attempts - 1:
                        return self.fallback._embed_one(text)
                    retry_after = exc.headers.get("Retry-After")
                    try:
                        delay = max(0.1, float(retry_after)) if retry_after else settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                    except (ValueError, TypeError):
                        delay = settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                    time.sleep(delay)
                    continue
                else:
                    # Non-retryable HTTP error (e.g. 400, 403, 404)
                    return self.fallback._embed_one(text)
            except Exception:
                # Network or timeout errors
                if attempt >= max_attempts - 1:
                    return self.fallback._embed_one(text)
                time.sleep(settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt))
                continue
        else:
            return self.fallback._embed_one(text)

        embedding = body.get("embedding") or {}
        values = embedding.get("values")
        if not values or len(values) != self.dimension:
            return self.fallback._embed_one(text)
        return [float(v) for v in values]


def get_embedding_provider() -> EmbeddingProvider:
    if settings.GEMINI_API_KEY:
        return GeminiEmbeddingProvider(
            api_key=settings.GEMINI_API_KEY,
            base_url=settings.GEMINI_API_BASE_URL,
            dimension=settings.EMBEDDING_DIMENSION,
        )
    return DeterministicEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)

