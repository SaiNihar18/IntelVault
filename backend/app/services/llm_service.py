from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from urllib import error, request

from app.core.config import settings


class ChatCompletionProvider(ABC):
    @abstractmethod
    def generate_answer(self, question: str, context_blocks: list[str]) -> str:
        raise NotImplementedError


class DeterministicChatProvider(ChatCompletionProvider):
    def generate_answer(self, question: str, context_blocks: list[str]) -> str:
        if not context_blocks:
            return "I could not find accessible document content relevant to that question."

        excerpts = [block.strip() for block in context_blocks[:3] if block.strip()]
        body = " ".join(excerpts)[:1200]
        return "Based on the accessible documents, the most relevant information is: " + body


def _build_context_prompt(question: str, context_blocks: list[str]) -> str:
    trimmed_blocks = [block.strip()[:900] for block in context_blocks[:4] if block.strip()]
    if not trimmed_blocks:
        return (
            "You are IntelVault AI, a helpful secure document assistant. "
            "The user is asking a general question or greeting. "
            "Respond politely and conversationally.\n\n"
            f"Question: {question}"
        )
    context_text = "\n\n".join(trimmed_blocks)
    return (
        "You are IntelVault AI, a secure document assistant. "
        "Answer the user's question using the provided document context blocks. "
        "Cite the document and page details if helpful. "
        "If the context doesn't contain the answer, use your general knowledge but mention that it is not explicitly stated in the workspace documents.\n\n"
        f"Context:\n{context_text}\n\n"
        f"Question: {question}"
    )


def _parse_retry_after_seconds(exc: error.HTTPError) -> float | None:
    retry_after = exc.headers.get("Retry-After") if exc.headers else None
    if not retry_after:
        return None
    try:
        return max(0.0, float(retry_after))
    except ValueError:
        return None


def _is_retryable_status(status_code: int) -> bool:
    return status_code in {408, 429, 500, 502, 503, 504}


def _gemini_timeout() -> float:
    return float(settings.GEMINI_REQUEST_TIMEOUT_SECONDS)


class GeminiChatProvider(ChatCompletionProvider):
    def generate_answer(self, question: str, context_blocks: list[str]) -> str:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is required for the Gemini provider")

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": _build_context_prompt(question, context_blocks),
                        }
                    ],
                }
            ],
            "generationConfig": {"temperature": 0.2},
        }
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"{settings.GEMINI_API_BASE_URL.rstrip('/')}/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        max_attempts = max(1, settings.GEMINI_MAX_RETRIES + 1)
        fallback = DeterministicChatProvider().generate_answer

        last_error: Exception | None = None
        for attempt in range(max_attempts):
            try:
                with request.urlopen(req, timeout=_gemini_timeout()) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                break
            except error.HTTPError as exc:
                last_error = exc
                if not _is_retryable_status(exc.code):
                    raise RuntimeError(f"Gemini request failed with HTTP {exc.code}") from exc

                if attempt >= max_attempts - 1:
                    return fallback(question, context_blocks)

                retry_after = _parse_retry_after_seconds(exc)
                delay_seconds = retry_after if retry_after is not None else settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                time.sleep(delay_seconds)
                continue
            except error.URLError as exc:
                last_error = exc
                if attempt >= max_attempts - 1:
                    return fallback(question, context_blocks)
                delay_seconds = settings.GEMINI_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                time.sleep(delay_seconds)
                continue
        else:
            if last_error is not None:
                return fallback(question, context_blocks)
            raise RuntimeError("Gemini request failed unexpectedly")

        candidates = body.get("candidates") or []
        if not candidates:
            raise RuntimeError("Gemini response missing candidates")

        content_parts = candidates[0].get("content", {}).get("parts") or []
        content = "".join(part.get("text", "") for part in content_parts if isinstance(part, dict))
        if not content:
            raise RuntimeError("Gemini response missing assistant content")
        return str(content)


def get_chat_completion_provider() -> ChatCompletionProvider:
    if settings.LLM_PROVIDER.lower() == "gemini" and settings.GEMINI_API_KEY:
        return GeminiChatProvider()
    return DeterministicChatProvider()
