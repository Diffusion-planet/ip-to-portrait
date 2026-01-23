"""
Application configuration settings
"""
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# Path to .env file (inpainting-pipeline/.env)
ENV_FILE = Path(__file__).parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    # Database (required - must be set in .env)
    DATABASE_URL: str

    # Redis (for Celery)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Celery (parallel processing)
    USE_CELERY: bool = False

    # JWT (required - must be set in .env)
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8008

    class Config:
        env_file = str(ENV_FILE)
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
