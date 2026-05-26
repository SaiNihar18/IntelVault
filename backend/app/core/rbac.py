from __future__ import annotations

from enum import Enum


class WorkspaceRole(str, Enum):
    owner = "owner"
    analyst = "analyst"
    reviewer = "reviewer"
    guest = "guest"
