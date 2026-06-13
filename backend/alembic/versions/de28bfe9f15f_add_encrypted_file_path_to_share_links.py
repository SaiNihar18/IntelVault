"""add_encrypted_file_path_to_share_links

Revision ID: de28bfe9f15f
Revises: 20260414_0008
Create Date: 2026-06-13 12:17:00.448930

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'de28bfe9f15f'
down_revision: Union[str, Sequence[str], None] = '20260414_0008'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('document_share_links', sa.Column('encrypted_file_path', sa.String(length=512), nullable=True))


def downgrade() -> None:
    op.drop_column('document_share_links', 'encrypted_file_path')
