import base64
import json
import logging
import os
import shutil
import urllib.error
import urllib.request
from io import BytesIO

from PIL import Image
import pytesseract

from app.core.config import settings

logger = logging.getLogger(__name__)


def _is_tesseract_available() -> bool:
    """Check if a usable tesseract binary is configured or in PATH."""
    if settings.TESSERACT_CMD:
        cmd = settings.TESSERACT_CMD
        if os.path.isfile(cmd) or shutil.which(cmd):
            return True
    return bool(shutil.which("tesseract"))


def _gemini_vision_ocr(image_bytes: bytes, mime_type: str = "image/png") -> str | None:
    """Extract and transcribe all text, database schemas, tables, diagrams, and structures from image using Gemini Vision."""
    if not settings.GEMINI_API_KEY:
        return None

    try:
        b64_data = base64.b64encode(image_bytes).decode("utf-8")
        url = f"{settings.GEMINI_API_BASE_URL.rstrip('/')}/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [
                        {
                            "text": (
                                "You are an expert document OCR and technical diagram transcription system. "
                                "Carefully extract and transcribe all visible text, database schemas, tables, entity-relationship diagrams, "
                                "column names, data types, primary/foreign keys, relations, flowcharts, code, labels, and descriptions from this image. "
                                "Format the output as clean, complete, highly detailed Markdown so it can be indexed, searched, and queried by a RAG system."
                            )
                        },
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_data,
                            }
                        },
                    ],
                }
            ],
            "generationConfig": {"temperature": 0.1},
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = json.loads(resp.read().decode("utf-8"))

        candidates = body.get("candidates") or []
        if not candidates:
            return None

        parts = candidates[0].get("content", {}).get("parts") or []
        extracted_text = "".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()
        return extracted_text if extracted_text else None
    except Exception as exc:
        logger.warning("gemini_vision_ocr_failed", extra={"error": str(exc)})
        return None


def run_ocr_on_image_bytes(image_bytes: bytes, filename: str = "Image") -> str:
    """Extract text from image bytes using Gemini Vision, Tesseract OCR, or graceful fallback."""
    image_info = "Image"
    mime_type = "image/png"
    try:
        image = Image.open(BytesIO(image_bytes))
        fmt = image.format or "PNG"
        image_info = f"{filename} ({fmt}, {image.width}x{image.height})"
        mime_type = Image.MIME.get(fmt.upper(), "image/png")
    except Exception as e:
        logger.warning("ocr_image_open_failed", extra={"filename": filename, "error": str(e)})
        return f"[{filename}: Image parsing failed]"

    # 1. Primary High-Accuracy Vision Extraction (Gemini Multimodal)
    if settings.GEMINI_API_KEY:
        vision_result = _gemini_vision_ocr(image_bytes, mime_type=mime_type)
        if vision_result:
            clean_vision = vision_result.replace("\x00", "").strip()
            if clean_vision:
                logger.info("gemini_vision_ocr_success", extra={"filename": filename, "length": len(clean_vision)})
                return clean_vision

    # 2. Secondary Local OCR Extraction (Tesseract)
    if settings.TESSERACT_CMD and (os.path.isfile(settings.TESSERACT_CMD) or shutil.which(settings.TESSERACT_CMD)):
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    if _is_tesseract_available():
        try:
            raw_text = pytesseract.image_to_string(image, lang=settings.OCR_LANG)
            clean_text = raw_text.replace("\x00", "").strip() if raw_text else ""
            if clean_text:
                return clean_text
            return f"[Image Document: {image_info} — No selectable text detected]"
        except Exception as exc:
            logger.warning(
                "tesseract_ocr_execution_failed",
                extra={"filename": filename, "error": str(exc)},
            )

    # 3. Fallback Metadata Summary
    logger.warning(
        "image_ocr_unavailable",
        extra={"filename": filename, "note": "Vision and Tesseract unavailable; using fallback summary."},
    )
    return f"[Image Document: {image_info}]"


