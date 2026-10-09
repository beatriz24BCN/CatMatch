from pydantic import BaseSettings

class Settings(BaseSettings):
    # DATABASE_URL should be provided via environment variables (.env or docker-compose)
    # Leave empty by default to avoid hardcoding credentials in the repository.
    DATABASE_URL: str = ""
    env: str = "dev"

    class Config:
        env_file = ".env"

settings = Settings()

# fail fast if DATABASE_URL is not configured
if not settings.DATABASE_URL:
    raise RuntimeError('DATABASE_URL is not set. Provide it via .env or the environment (e.g. in docker-compose .env).')
