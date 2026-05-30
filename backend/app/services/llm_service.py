from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from urllib import error, request

from app.core.config import settings


class ChatCompletionProvider(ABC):
    @abstractmethod
    def generate_answer(
        self,
        question: str,
        context_blocks: list[str],
        workspace_name: str = "Unknown",
        document_count: int = 0,
    ) -> str:
        raise NotImplementedError


class DeterministicChatProvider(ChatCompletionProvider):
    def generate_answer(
        self,
        question: str,
        context_blocks: list[str],
        workspace_name: str = "Unknown",
        document_count: int = 0,
    ) -> str:
        if not context_blocks:
            return "I could not find accessible document content relevant to that question. [NO_CONTEXT_USED]"

        excerpts = [block.strip() for block in context_blocks[:3] if block.strip()]
        body = " ".join(excerpts)[:1200]
        return "Based on the accessible documents, the most relevant information is: " + body


def _build_context_prompt(
    question: str,
    context_blocks: list[str],
    workspace_name: str,
    document_count: int,
) -> str:
    system_prompt = (
        f"You are IntelVault AI, a helpful secure document assistant.\n"
        f"Role & Context: You are operating within the '{workspace_name}' workspace, which currently contains {document_count} documents. "
        "Maintain awareness of this environment and provide these details if asked.\n\n"
        "Guidelines:\n"
        "1. Greetings & Casual Interactions: Respond naturally and conversationally to greetings (e.g. 'Hey there', 'hello', 'hi') "
        "without generating citations or searching the document base. Append [NO_CONTEXT_USED] at the end of your response.\n"
        "2. General Queries: Answer broad, general knowledge questions using standard capabilities without forcing citations from the workspace documents. "
        "Append [NO_CONTEXT_USED] at the end of your response.\n"
        "3. Out-of-Context Queries: If a question requires specific knowledge that is not present in the provided document set (PDS) or context, "
        "do not attempt to guess or cite irrelevant information. Instead, respond formally: 'The requested information is not available within the current workspace documents.' "
        "Append [NO_CONTEXT_USED] at the end of your response.\n"
        "4. Context-Based Queries: If the answer is present in the context, answer using the context. Cite the document and page details if helpful.\n"
    )

    trimmed_blocks = [block.strip()[:900] for block in context_blocks[:4] if block.strip()]
    if not trimmed_blocks:
        return (
            f"{system_prompt}\n"
            f"Question: {question}"
        )
    context_text = "\n\n".join(trimmed_blocks)
    return (
        f"{system_prompt}\n"
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
    def generate_answer(
        self,
        question: str,
        context_blocks: list[str],
        workspace_name: str = "Unknown",
        document_count: int = 0,
    ) -> str:
        if not settings.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is required for the Gemini provider")

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": _build_context_prompt(question, context_blocks, workspace_name, document_count),
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


class GroqChatProvider(ChatCompletionProvider):
    def generate_answer(
        self,
        question: str,
        context_blocks: list[str],
        workspace_name: str = "Unknown",
        document_count: int = 0,
    ) -> str:
        if not settings.GROQ_API_KEY:
            raise RuntimeError("GROQ_API_KEY is required for the Groq provider")

        payload = {
            "model": settings.GROQ_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": _build_context_prompt(question, context_blocks, workspace_name, document_count),
                }
            ],
            "temperature": 0.2,
        }
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"{settings.GROQ_API_BASE_URL.rstrip('/')}/chat/completions",
            data=data,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
            method="POST",
        )
        max_attempts = max(1, settings.GROQ_MAX_RETRIES + 1)
        fallback = DeterministicChatProvider().generate_answer

        last_error: Exception | None = None
        for attempt in range(max_attempts):
            try:
                with request.urlopen(req, timeout=float(settings.GROQ_REQUEST_TIMEOUT_SECONDS)) as resp:
                    body = json.loads(resp.read().decode("utf-8"))
                break
            except error.HTTPError as exc:
                last_error = exc
                if not _is_retryable_status(exc.code):
                    raise RuntimeError(f"Groq request failed with HTTP {exc.code}") from exc

                if attempt >= max_attempts - 1:
                    return fallback(question, context_blocks)

                retry_after = _parse_retry_after_seconds(exc)
                delay_seconds = retry_after if retry_after is not None else settings.GROQ_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                time.sleep(delay_seconds)
                continue
            except error.URLError as exc:
                last_error = exc
                if attempt >= max_attempts - 1:
                    return fallback(question, context_blocks)
                delay_seconds = settings.GROQ_RETRY_BASE_DELAY_SECONDS * (2**attempt)
                time.sleep(delay_seconds)
                continue
        else:
            if last_error is not None:
                return fallback(question, context_blocks)
            raise RuntimeError("Groq request failed unexpectedly")

        choices = body.get("choices") or []
        if not choices:
            raise RuntimeError("Groq response missing choices")

        content = choices[0].get("message", {}).get("content")
        if content is None:
            raise RuntimeError("Groq response missing assistant content")
        return str(content)


def get_chat_completion_provider() -> ChatCompletionProvider:
    provider = settings.LLM_PROVIDER.lower()
    if provider == "gemini" and settings.GEMINI_API_KEY:
        return GeminiChatProvider()
    elif provider == "groq" and settings.GROQ_API_KEY:
        return GroqChatProvider()
    return DeterministicChatProvider()
