from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import models to ensure they are registered on the Base metadata
# This makes Base.metadata.create_all() and Alembic autogenerate work
from ..models import person, cat, adoption_request  # noqa: F401
