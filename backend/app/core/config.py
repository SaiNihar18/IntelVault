import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve `backend/.env` regardless of process cwd (fixes uvicorn --reload workers on Windows).
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "IntelVault"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    API_V1_PREFIX: str = "/api/v1"

    DATABASE_URL: str = Field(
        ...,
        description="Async SQLAlchemy URL, e.g. postgresql+asyncpg://user:pass@host/db",
    )

    CORS_ORIGINS: str | list[str] = Field(default_factory=lambda: ["http://localhost:3000", "http://localhost:5173"])

    JWT_SECRET: str = Field(
        ...,
        min_length=32,
        description="HS256 signing secret; use a long random value in production.",
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BCRYPT_ROUNDS: int = 12
    FILE_STORAGE_ROOT: str = str(_BACKEND_ROOT / "storage")
    CHUNK_SIZE_CHARS: int = 1200
    CHUNK_OVERLAP_CHARS: int = 200
    EMBEDDING_DIMENSION: int = 128
    ENABLE_OCR: bool = False
    OCR_MIN_PAGE_TEXT_CHARS: int = 40
    OCR_LANG: str = "eng"
    TESSERACT_CMD: str | None = None
    LLM_PROVIDER: str = "deterministic"
    GEMINI_API_BASE_URL: str = "https://generativelanguage.googleapis.com/v1beta"
    GEMINI_API_KEY: str | None = None
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GEMINI_MAX_RETRIES: int = 3
    GEMINI_RETRY_BASE_DELAY_SECONDS: float = 1.0
    GEMINI_REQUEST_TIMEOUT_SECONDS: float = 60.0
    GROQ_API_KEY: str | None = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GROQ_API_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MAX_RETRIES: int = 3
    GROQ_RETRY_BASE_DELAY_SECONDS: float = 1.0
    GROQ_REQUEST_TIMEOUT_SECONDS: float = 60.0
    PUBLIC_API_BASE_URL: str = "http://127.0.0.1:8000"
    RETRIEVAL_TOP_K: int = 5
    RETRIEVAL_MIN_SCORE: float = 0.02
    RETRIEVAL_LEXICAL_WEIGHT: float = 0.25
    COHERE_API_KEY: str | None = None
    COHERE_RERANK_MODEL: str = "rerank-english-v3.0"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if v is None or v == "":
            return ["http://localhost:3000", "http://localhost:5173"]
        if isinstance(v, list):
            return [str(x).strip() for x in v if str(x).strip()]
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                try:
                    parsed = json.loads(s)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, list):
                    return [str(x).strip() for x in parsed if str(x).strip()]
            return [part.strip() for part in v.split(",") if part.strip()]
        raise TypeError("CORS_ORIGINS must be a comma-separated string or a list")

    @field_validator("BCRYPT_ROUNDS")
    @classmethod
    def validate_bcrypt_rounds(cls, v: int) -> int:
        if v < 4 or v > 31:
            raise ValueError("BCRYPT_ROUNDS must be between 4 and 31")
        return v

    @field_validator("CHUNK_SIZE_CHARS")
    @classmethod
    def validate_chunk_size(cls, v: int) -> int:
        if v < 200:
            raise ValueError("CHUNK_SIZE_CHARS must be >= 200")
        return v

    @field_validator("CHUNK_OVERLAP_CHARS")
    @classmethod
    def validate_chunk_overlap(cls, v: int) -> int:
        if v < 0:
            raise ValueError("CHUNK_OVERLAP_CHARS must be >= 0")
        return v

    @field_validator("EMBEDDING_DIMENSION")
    @classmethod
    def validate_embedding_dimension(cls, v: int) -> int:
        if v < 8:
            raise ValueError("EMBEDDING_DIMENSION must be >= 8")
        return v

    @field_validator("OCR_MIN_PAGE_TEXT_CHARS")
    @classmethod
    def validate_ocr_min_page_text_chars(cls, v: int) -> int:
        if v < 0:
            raise ValueError("OCR_MIN_PAGE_TEXT_CHARS must be >= 0")
        return v

    @field_validator("GEMINI_MAX_RETRIES")
    @classmethod
    def validate_gemini_max_retries(cls, v: int) -> int:
        if v < 0 or v > 10:
            raise ValueError("GEMINI_MAX_RETRIES must be between 0 and 10")
        return v

    @field_validator("GEMINI_RETRY_BASE_DELAY_SECONDS")
    @classmethod
    def validate_gemini_retry_base_delay_seconds(cls, v: float) -> float:
        if v < 0:
            raise ValueError("GEMINI_RETRY_BASE_DELAY_SECONDS must be >= 0")
        return v

    @field_validator("GEMINI_REQUEST_TIMEOUT_SECONDS")
    @classmethod
    def validate_gemini_request_timeout_seconds(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("GEMINI_REQUEST_TIMEOUT_SECONDS must be > 0")
        return v

    @field_validator("GROQ_MAX_RETRIES")
    @classmethod
    def validate_groq_max_retries(cls, v: int) -> int:
        if v < 0 or v > 10:
            raise ValueError("GROQ_MAX_RETRIES must be between 0 and 10")
        return v

    @field_validator("GROQ_RETRY_BASE_DELAY_SECONDS")
    @classmethod
    def validate_groq_retry_base_delay_seconds(cls, v: float) -> float:
        if v < 0:
            raise ValueError("GROQ_RETRY_BASE_DELAY_SECONDS must be >= 0")
        return v

    @field_validator("GROQ_REQUEST_TIMEOUT_SECONDS")
    @classmethod
    def validate_groq_request_timeout_seconds(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("GROQ_REQUEST_TIMEOUT_SECONDS must be > 0")
        return v

    @field_validator("RETRIEVAL_TOP_K")
    @classmethod
    def validate_retrieval_top_k(cls, v: int) -> int:
        if v < 1 or v > 20:
            raise ValueError("RETRIEVAL_TOP_K must be between 1 and 20")
        return v

    @field_validator("RETRIEVAL_MIN_SCORE")
    @classmethod
    def validate_retrieval_min_score(cls, v: float) -> float:
        if v < -1 or v > 1:
            raise ValueError("RETRIEVAL_MIN_SCORE must be between -1 and 1")
        return v

    @field_validator("RETRIEVAL_LEXICAL_WEIGHT")
    @classmethod
    def validate_retrieval_lexical_weight(cls, v: float) -> float:
        if v < 0 or v > 1:
            raise ValueError("RETRIEVAL_LEXICAL_WEIGHT must be between 0 and 1")
        return v


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
