import logging
import os
import shutil
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


def run_ocr_on_image_bytes(image_bytes: bytes, filename: str = "Image") -> str:
    """Extract text from image bytes using Tesseract OCR with graceful fallback if unavailable."""
    image_info = "Image"
    try:
        image = Image.open(BytesIO(image_bytes))
        fmt = image.format or "Image"
        image_info = f"{filename} ({fmt}, {image.width}x{image.height})"
    except Exception as e:
        logger.warning("ocr_image_open_failed", extra={"filename": filename, "error": str(e)})
        return f"[{filename}: Image parsing failed]"

    # If tesseract command is specified and points to a file, configure pytesseract
    if settings.TESSERACT_CMD and (os.path.isfile(settings.TESSERACT_CMD) or shutil.which(settings.TESSERACT_CMD)):
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    if not _is_tesseract_available():
        logger.warning(
            "tesseract_ocr_unavailable",
            extra={"filename": filename, "note": "Tesseract binary not found on server; using fallback summary."},
        )
        return f"[Image Document: {image_info} — OCR is unavailable because Tesseract is not installed on the server]"

    try:
        raw_text = pytesseract.image_to_string(image, lang=settings.OCR_LANG)
        clean_text = raw_text.replace("\x00", "").strip() if raw_text else ""
        if clean_text:
            return clean_text
        return f"[Image Document: {image_info} — No text detected]"
    except (FileNotFoundError, pytesseract.TesseractNotFoundError) as exc:
        logger.warning(
            "tesseract_ocr_binary_missing",
            extra={"filename": filename, "error": str(exc)},
        )
        return f"[Image Document: {image_info} — OCR is unavailable because Tesseract is not installed on the server]"
    except Exception as exc:
        logger.warning(
            "tesseract_ocr_execution_failed",
            extra={"filename": filename, "error": str(exc)},
        )
        return f"[Image Document: {image_info} — OCR extraction encountered an error: {str(exc)}]"

