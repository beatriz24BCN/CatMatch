"""add person time columns
Revision ID: 0002_add_person_time_columns
Revises: 0001_initial
Create Date: 2026-10-12 10:21:49.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0002_add_person_time_columns'
down_revision = '0001_initial'
branch_labels = None
depends_on = None


def upgrade():
    # Add qualitative time fields to persons (MVP, nullable)
    op.add_column(
        'persons',
        sa.Column('time_outside', sa.String(length=100), nullable=True),
    )
    op.add_column(
        'persons',
        sa.Column('time_available', sa.String(length=100), nullable=True),
    )


def downgrade():
    # Remove the columns in reverse order of creation
    op.drop_column('persons', 'time_available')
    op.drop_column('persons', 'time_outside')
