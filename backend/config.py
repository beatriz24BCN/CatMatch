import os


class Config:
    """Base configuration for the CatMatch backend.

    Values are loaded from environment variables. Real values (database,
    JWT secret, AI API key, etc.) will be added in later development stages.
    """

    DATABASE_URL = os.environ.get("DATABASE_URL")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
    AI_API_KEY = os.environ.get("AI_API_KEY")
