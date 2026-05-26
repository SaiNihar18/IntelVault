from __future__ import annotations

from io import BytesIO

from PIL import Image
import pytesseract

from app.core.config import settings


def run_ocr_on_image_bytes(image_bytes: bytes) -> str:
    if settings.TESSERACT_CMD:
        pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD

    image = Image.open(BytesIO(image_bytes))
    return pytesseract.image_to_string(image, lang=settings.OCR_LANG)
