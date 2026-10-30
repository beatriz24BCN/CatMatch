"""add users.token_version and password_reset_tokens
Revision ID: 0004_password_reset
Revises: 0003_add_users_table
Create Date: 2026-10-29 19:00:00.000000

Migración solo aditiva:
- users.token_version: contador para invalidar sesiones (JWT) emitidas antes de
  un restablecimiento de contraseña. Las filas existentes reciben 0.
- password_reset_tokens: tokens de recuperación de un solo uso. Solo se guarda
  el hash SHA-256 del token, nunca el token en claro.
"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg

# revision identifiers, used by Alembic.
revision = '0004_password_reset'
down_revision = '0003_add_users_table'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'users',
        sa.Column('token_version', sa.Integer(), nullable=False, server_default=sa.text('0')),
    )
    op.create_table(
        'password_reset_tokens',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            'user_id',
            pg.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('used_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), nullable=False, server_default=sa.text('now()')),
    )
    op.create_index('ix_password_reset_tokens_token_hash', 'password_reset_tokens', ['token_hash'], unique=True)
    op.create_index('ix_password_reset_tokens_user_id', 'password_reset_tokens', ['user_id'])


def downgrade():
    op.drop_index('ix_password_reset_tokens_user_id', table_name='password_reset_tokens')
    op.drop_index('ix_password_reset_tokens_token_hash', table_name='password_reset_tokens')
    op.drop_table('password_reset_tokens')
    op.drop_column('users', 'token_version')
