from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import fitz

from app.core.config import settings
from app.core.errors import IntelVaultError
from app.services.ocr_service import run_ocr_on_image_bytes


class UnsupportedDocumentTypeError(IntelVaultError):
    def __init__(self, filename: str) -> None:
        super().__init__(f"Unsupported document type: {filename}", status_code=400)


def sanitize_text(text: str | None) -> str:
    """Strip null bytes (0x00) and normalize text for safe database insertion."""
    if not text:
        return ""
    # PostgreSQL cannot store \x00 in UTF-8 strings.
    return text.replace("\x00", "")


@dataclass(slots=True)
class ParsedSegment:
    text: str
    metadata: dict[str, object]


@dataclass(slots=True)
class ParsedDocument:
    full_text: str
    segments: list[ParsedSegment]
    metadata: dict[str, object]


def _parse_pdf(file_path: str, *, filename: str = "document.pdf", file_bytes: bytes | None = None) -> ParsedDocument:
    if file_bytes is not None:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    else:
        doc = fitz.open(file_path)
    segments: list[ParsedSegment] = []

    for page_index, page in enumerate(doc):
        try:
            raw_native = page.get_text("text") or ""
        except Exception:
            raw_native = ""
        native_text = sanitize_text(raw_native).strip()

        if native_text:
            segments.append(
                ParsedSegment(
                    text=native_text,
                    metadata={
                        "source_type": "native_text",
                        "page_number": page_index + 1,
                    },
                )
            )

        # OCR fallback for image-heavy pages if enabled.
        if settings.ENABLE_OCR and len(native_text) < settings.OCR_MIN_PAGE_TEXT_CHARS:
            ocr_parts: list[str] = []
            try:
                image_list = page.get_images(full=True)
                for img_info in image_list:
                    try:
                        xref = img_info[0]
                        base_image = doc.extract_image(xref)
                        image_bytes = base_image["image"]
                        text = sanitize_text(
                            run_ocr_on_image_bytes(
                                image_bytes,
                                filename=f"{filename} (Page {page_index + 1})",
                            )
                        ).strip()
                        if text:
                            ocr_parts.append(text)
                    except Exception:
                        continue
            except Exception:
                pass

            ocr_text = "\n".join(ocr_parts).strip()
            if ocr_text:
                segments.append(
                    ParsedSegment(
                        text=ocr_text,
                        metadata={
                            "source_type": "ocr_text",
                            "page_number": page_index + 1,
                        },
                    )
                )

    if not segments:
        page_cnt = len(doc)
        fallback_msg = f"[Document: {filename} — PDF with {page_cnt} page(s) contained no selectable text]"
        segments.append(
            ParsedSegment(
                text=fallback_msg,
                metadata={"source_type": "fallback", "page_number": 1},
            )
        )

    full_text = sanitize_text("\n\n".join(seg.text for seg in segments))
    return ParsedDocument(
        full_text=full_text,
        segments=segments,
        metadata={
            "parser": "pymupdf",
            "ocr_enabled": settings.ENABLE_OCR,
            "page_count": len(doc),
        },
    )


def parse_document(*, file_path: str, filename: str, file_bytes: bytes | None = None) -> ParsedDocument:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in {".txt", ".md", ".csv", ".json", ".py", ".log"}:
        if file_bytes is not None:
            raw_text = file_bytes.decode("utf-8", errors="ignore")
        else:
            raw_text = path.read_text(encoding="utf-8", errors="ignore")
        text = sanitize_text(raw_text).strip()
        if not text:
            text = f"[Document: {filename} (Empty text file)]"
        return ParsedDocument(
            full_text=text,
            segments=[
                ParsedSegment(
                    text=text,
                    metadata={"source_type": "native_text", "page_number": 1},
                )
            ],
            metadata={"parser": "plain_text", "ocr_enabled": False, "page_count": 1},
        )

    if suffix == ".pdf":
        return _parse_pdf(str(path), filename=filename, file_bytes=file_bytes)

    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        if file_bytes is None:
            file_bytes = path.read_bytes()
        text = sanitize_text(run_ocr_on_image_bytes(file_bytes, filename=filename)).strip()
        if not text:
            text = f"[Image Document: {filename}]"
        return ParsedDocument(
            full_text=text,
            segments=[
                ParsedSegment(
                    text=text,
                    metadata={"source_type": "ocr_text", "page_number": 1},
                )
            ],
            metadata={"parser": "pytesseract", "ocr_enabled": True, "page_count": 1},
        )

    raise UnsupportedDocumentTypeError(filename)

