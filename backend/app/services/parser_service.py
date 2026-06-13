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


@dataclass(slots=True)
class ParsedSegment:
    text: str
    metadata: dict[str, object]


@dataclass(slots=True)
class ParsedDocument:
    full_text: str
    segments: list[ParsedSegment]
    metadata: dict[str, object]


def _parse_pdf(file_path: str) -> ParsedDocument:
    doc = fitz.open(file_path)
    segments: list[ParsedSegment] = []

    for page_index, page in enumerate(doc):
        native_text = (page.get_text("text") or "").strip()
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

        # OCR fallback for image-heavy pages.
        if settings.ENABLE_OCR and len(native_text) < settings.OCR_MIN_PAGE_TEXT_CHARS:
            ocr_parts: list[str] = []
            image_list = page.get_images(full=True)
            for img_info in image_list:
                try:
                    xref = img_info[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image["image"]
                    text = run_ocr_on_image_bytes(image_bytes).strip()
                except Exception:
                    text = ""
                if text:
                    ocr_parts.append(text)

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

    full_text = "\n\n".join(seg.text for seg in segments)
    return ParsedDocument(
        full_text=full_text,
        segments=segments,
        metadata={
            "parser": "pymupdf",
            "ocr_enabled": settings.ENABLE_OCR,
            "page_count": len(doc),
        },
    )


def parse_document(*, file_path: str, filename: str) -> ParsedDocument:
    path = Path(file_path)
    suffix = path.suffix.lower()

    if suffix in {".txt", ".md", ".csv", ".json", ".py", ".log"}:
        text = path.read_text(encoding="utf-8", errors="ignore")
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
        return _parse_pdf(str(path))

    raise UnsupportedDocumentTypeError(filename)
