import pydantic as _pydantic

try:
    # pydantic v2: BaseSettings provided via pydantic-settings package
    from pydantic_settings import BaseSettings
    _using_pydantic_v2 = True
except Exception:
    # fallback for older environments where pydantic v1 is used
    from pydantic import BaseSettings
    _using_pydantic_v2 = False

# Define Settings differently depending on pydantic major version to avoid
# mixing `Config` and `model_config` which is invalid in pydantic v2.
if _using_pydantic_v2:
    class Settings(BaseSettings):
        DATABASE_URL: str = ""
        env: str = "dev"

        # pydantic v2 style configuration
        model_config = {
            "extra": "ignore",
            "env_file": ".env",
        }
else:
    class Settings(BaseSettings):
        DATABASE_URL: str = ""
        env: str = "dev"

        class Config:
            env_file = ".env"
            # allow other environment variables to exist without failing validation
            extra = "ignore"

settings = Settings()

# fail fast if DATABASE_URL is not configured
if not settings.DATABASE_URL:
    raise RuntimeError('DATABASE_URL is not set. Provide it via .env or the environment (e.g. in docker-compose .env).')
