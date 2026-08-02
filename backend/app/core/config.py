import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DB_PATH = BASE_DIR / "accounting.db"

class Settings(BaseModel):
    PROJECT_NAME: str = "Multi-Bank Accounting & Statement Analyzer"
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "data", "uploads")

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

