"""initial_schema

Revision ID: 4d89c2540180
Revises:
Create Date: 2026-01-24 03:15:42.138108

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d89c2540180'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Create history table
    op.create_table(
        'history',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('face_image_url', sa.String(length=500), nullable=False),
        sa.Column('face_image_id', sa.String(length=255), nullable=True),
        sa.Column('reference_image_url', sa.String(length=500), nullable=True),
        sa.Column('reference_image_id', sa.String(length=255), nullable=True),
        sa.Column('result_urls', sa.JSON(), nullable=True),
        sa.Column('prompt', sa.Text(), nullable=True),
        sa.Column('params', sa.JSON(), nullable=True),
        sa.Column('count', sa.String(), nullable=True, default='1'),
        sa.Column('parallel', sa.Boolean(), nullable=True, default=False),
        sa.Column('is_favorite', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_history_user_id'), 'history', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_history_user_id'), table_name='history')
    op.drop_table('history')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
