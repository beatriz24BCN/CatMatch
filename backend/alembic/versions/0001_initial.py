"""initial
Revision ID: 0001_initial
Revises: 
Create Date: 2026-10-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
import sqlalchemy.dialects.postgresql as pg

# revision identifiers, used by Alembic.
revision = '0001_initial'
down_revision = None
branch_labels = None
def upgrade():
    op.create_table(
        'persons',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('full_name', sa.String(length=255), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('household_type', sa.String(length=20), nullable=True),
        sa.Column('has_children', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('has_other_pets', sa.Boolean(), nullable=True, server_default=sa.text('false')),
        sa.Column('other_pets_details', pg.JSONB(), nullable=True),
        sa.Column('activity_level', sa.String(length=10), nullable=True),
        sa.Column('home_type', sa.String(length=20), nullable=True),
        sa.Column('home_size', sa.String(length=10), nullable=True),
        sa.Column('has_outdoor_space', sa.Boolean(), nullable=True),
        sa.Column('work_hours_per_day', sa.SmallInteger(), nullable=True),
        sa.Column('personality_traits', pg.JSONB(), nullable=True),
        sa.Column('preferred_cat_traits', pg.JSONB(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
    )
    op.create_table(
        'cats',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('age_stage', sa.String(length=20), nullable=False),
        sa.Column('age_months', sa.SmallInteger(), nullable=True),
        sa.Column('sex', sa.String(length=10), nullable=True),
        sa.Column('breed', sa.String(length=255), nullable=True),
        sa.Column('size', sa.String(length=10), nullable=True),
        sa.Column('activity_level', sa.String(length=10), nullable=True),
        sa.Column('personality_traits', pg.JSONB(), nullable=True),
        sa.Column('good_with_children', sa.Boolean(), nullable=True),
        sa.Column('good_with_dogs', sa.Boolean(), nullable=True),
        sa.Column('vaccinated', sa.Boolean(), nullable=True),
        sa.Column('neutered', sa.Boolean(), nullable=True),
        sa.Column('health_status', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('image_urls', pg.JSONB(), nullable=True),
        sa.Column('location', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
    )
    op.create_table(
        'adoption_requests',
        sa.Column('id', pg.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('person_id', pg.UUID(as_uuid=True), sa.ForeignKey('persons.id'), nullable=True),
        sa.Column('cat_id', pg.UUID(as_uuid=True), sa.ForeignKey('cats.id'), nullable=False),
        sa.Column('contact_email', sa.String(length=255), nullable=False),
        sa.Column('contact_phone', sa.String(length=50), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()')),
    )

def downgrade():
    op.drop_table('adoption_requests')
    op.drop_table('cats')
    op.drop_table('persons')
