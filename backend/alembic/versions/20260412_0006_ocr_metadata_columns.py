"""Add extraction and chunk metadata for OCR-aware parsing.

Revision ID: 20260412_0006
Revises: 20260412_0005
Create Date: 2026-04-12

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260412_0006"
down_revision: Union[str, Sequence[str], None] = "20260412_0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "document_versions",
        sa.Column("extraction_metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )
    op.add_column(
        "document_chunks",
        sa.Column("chunk_metadata", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
    )
    op.alter_column("document_versions", "extraction_metadata", server_default=None)
    op.alter_column("document_chunks", "chunk_metadata", server_default=None)


def downgrade() -> None:
    op.drop_column("document_chunks", "chunk_metadata")
    op.drop_column("document_versions", "extraction_metadata")
