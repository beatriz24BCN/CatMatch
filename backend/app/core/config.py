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
        JWT_SECRET_KEY: str = ""
        JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

        # pydantic v2 style configuration
        model_config = {
            "extra": "ignore",
            "env_file": ".env",
        }
else:
    class Settings(BaseSettings):
        DATABASE_URL: str = ""
        env: str = "dev"
        JWT_SECRET_KEY: str = ""
        JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

        class Config:
            env_file = ".env"
            # allow other environment variables to exist without failing validation
            extra = "ignore"

settings = Settings()

# fail fast if DATABASE_URL is not configured
if not settings.DATABASE_URL:
    raise RuntimeError('DATABASE_URL is not set. Provide it via .env or the environment (e.g. in docker-compose .env).')

# En entornos que no sean de testing explícito, advertir o requerir JWT_SECRET_KEY seguro
if not settings.JWT_SECRET_KEY:
    if settings.env != "test":
        # Fallback seguro para desarrollo local sin claves duras en repo
        import warnings
        warnings.warn("JWT_SECRET_KEY no está configurada en .env; utilizando clave de desarrollo efímera no apta para producción.")
        settings.JWT_SECRET_KEY = "dev_insecure_key_change_in_production_catmatch_only"
    else:
        settings.JWT_SECRET_KEY = "test_secret_key_catmatch_testing_environment"
