import os
from dotenv import load_dotenv

load_dotenv()

LLM_BASE_URL: str = os.environ.get("LLM_BASE_URL", "http://malve:4100/v1")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "Gemma4-26B")
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")

DATABASE_URL: str = os.environ.get("DATABASE_URL", "sqlite+aiosqlite:///./compen.db")
CORS_ORIGINS: list[str] = [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
]

SECRET_KEY: str = os.environ.get("SECRET_KEY", "change-me-in-production")
ADMIN_USERNAME: str = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD: str = os.environ.get("ADMIN_PASSWORD", "changeme")
