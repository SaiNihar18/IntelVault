"""Unified storage manager — Supabase Storage with local-filesystem fallback.

If ``SUPABASE_URL`` and ``SUPABASE_SERVICE_KEY`` are both set the module
uses the Supabase Storage REST API to persist files.  Otherwise it falls
back to the local ``FILE_STORAGE_ROOT`` directory (suitable for local dev).
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


def _supabase_enabled() -> bool:
    """Return *True* when both Supabase credentials are configured."""
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


# ---------------------------------------------------------------------------
# Supabase helpers (stdlib only – no httpx / requests dependency)
# ---------------------------------------------------------------------------

def _supabase_storage_url(object_path: str) -> str:
    """Build the full Supabase Storage Object REST URL."""
    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_BUCKET
    encoded_path = urllib.parse.quote(object_path, safe="/")
    return f"{base}/storage/v1/object/{bucket}/{encoded_path}"


def _supabase_headers(content_type: str = "application/octet-stream") -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_KEY}",
        "apikey": settings.SUPABASE_SERVICE_KEY,
        "Content-Type": content_type,
    }


def _supabase_upload(object_path: str, data: bytes, *, upsert: bool = True) -> None:
    """Upload *data* to the Supabase bucket at *object_path*.

    Uses the ``POST /storage/v1/object/{bucket}/{path}`` endpoint with an
    ``x-upsert: true`` header so re-uploads overwrite transparently.
    """
    url = _supabase_storage_url(object_path)
    headers = _supabase_headers()
    if upsert:
        headers["x-upsert"] = "true"

    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            resp.read()  # drain response
            logger.info("supabase_upload_ok", extra={"path": object_path, "status": resp.status})
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        logger.error(
            "supabase_upload_failed",
            extra={"path": object_path, "status": exc.code, "body": body},
        )
        raise RuntimeError(f"Supabase upload failed ({exc.code}): {body}") from exc


def _supabase_download(object_path: str) -> bytes:
    """Download the object at *object_path* from the Supabase bucket."""
    url = _supabase_storage_url(object_path)
    headers = _supabase_headers()
    # GET does not need Content-Type but Supabase expects the apikey.
    headers.pop("Content-Type", None)
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        logger.error(
            "supabase_download_failed",
            extra={"path": object_path, "status": exc.code, "body": body},
        )
        raise RuntimeError(f"Supabase download failed ({exc.code}): {body}") from exc


def _supabase_delete(object_path: str) -> None:
    """Delete the object at *object_path* from the Supabase bucket."""
    base = settings.SUPABASE_URL.rstrip("/")
    bucket = settings.SUPABASE_BUCKET
    url = f"{base}/storage/v1/object/{bucket}"

    headers = _supabase_headers("application/json")
    payload = json.dumps({"prefixes": [object_path]}).encode()

    req = urllib.request.Request(url, data=payload, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
            logger.info("supabase_delete_ok", extra={"path": object_path, "status": resp.status})
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        # 404 is fine – the file was already gone.
        if exc.code == 404:
            logger.info("supabase_delete_not_found", extra={"path": object_path})
            return
        logger.error(
            "supabase_delete_failed",
            extra={"path": object_path, "status": exc.code, "body": body},
        )
        raise RuntimeError(f"Supabase delete failed ({exc.code}): {body}") from exc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def store_file(relative_path: str, data: bytes) -> str:
    """Persist *data* and return the canonical storage path.

    When Supabase is enabled the returned path is the bucket object key
    (e.g. ``workspaces/<wid>/documents/<did>/file.pdf``).  Otherwise it is
    the absolute local file path.
    """
    if _supabase_enabled():
        # Normalise Windows backslashes to forward slashes for Supabase keys.
        object_key = relative_path.replace("\\", "/")
        _supabase_upload(object_key, data)
        return object_key

    # Local fallback
    local_path = Path(settings.FILE_STORAGE_ROOT) / relative_path
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)
    return str(local_path)


def read_file(storage_path: str) -> bytes:
    """Return the raw bytes for a previously stored file."""
    if _supabase_enabled():
        object_key = storage_path.replace("\\", "/")
        return _supabase_download(object_key)

    local_path = Path(storage_path)
    if not local_path.is_file():
        raise FileNotFoundError(f"File not found: {storage_path}")
    return local_path.read_bytes()


def delete_file(storage_path: str) -> None:
    """Remove a previously stored file (best-effort, never raises)."""
    try:
        if _supabase_enabled():
            object_key = storage_path.replace("\\", "/")
            _supabase_delete(object_key)
            return

        local_path = Path(storage_path)
        if local_path.is_file():
            local_path.unlink()
        parent = local_path.parent
        if parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
    except Exception:
        logger.exception("storage_delete_failed", extra={"path": storage_path})


def file_exists(storage_path: str) -> bool:
    """Return True if the file exists in storage."""
    try:
        if _supabase_enabled():
            # Attempt a download to check existence (small cost, but reliable).
            _supabase_download(storage_path.replace("\\", "/"))
            return True
        return Path(storage_path).is_file()
    except Exception:
        return False
