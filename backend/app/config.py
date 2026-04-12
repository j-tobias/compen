import os
from dotenv import load_dotenv

load_dotenv()

LLM_BASE_URL: str = os.environ.get("LLM_BASE_URL", "http://malve:4100/v1")
LLM_MODEL: str = os.environ.get("LLM_MODEL", "Gemma4-26B")
LLM_API_KEY: str = os.environ.get("LLM_API_KEY", "")
