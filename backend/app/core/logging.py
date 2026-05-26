import logging
import sys
from typing import Final

_DEFAULT_FORMAT: Final[str] = (
    "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
)


def setup_logging(level: str = "INFO") -> None:
    """Configure root logger for stdout with a consistent, grep-friendly format."""
    numeric = getattr(logging, level.upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(numeric)

    if root.handlers:
        root.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric)
    handler.setFormatter(logging.Formatter(_DEFAULT_FORMAT))
    root.addHandler(handler)

    # Reduce noise from overly chatty libraries in development
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
