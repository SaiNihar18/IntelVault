"""Initial empty revision (Phase 1 scaffold).

Revision ID: 20260411_0001
Revises:
Create Date: 2026-04-11

"""

from typing import Sequence, Union

revision: str = "20260411_0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
