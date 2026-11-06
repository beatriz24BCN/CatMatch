"""add name to users table

Revision ID: 0005_add_users_name
Revises: 0004_password_reset
Create Date: 2026-11-04 14:00:00.000000

Migración exclusivamente aditiva:
- users.name: VARCHAR(100) nullable=True para almacenar el nombre real/preferido
  de los usuarios registrados. Las filas existentes quedan con NULL.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0005_add_users_name'
down_revision = '0004_password_reset'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column('name', sa.String(length=100), nullable=True),
    )


def downgrade():
    op.drop_column('users', 'name')
