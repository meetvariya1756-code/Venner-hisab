import os
from pydantic import BaseModel

class Settings(BaseModel):
    PROJECT_NAME: str = "Multi-Bank Accounting & Statement Analyzer"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./accounting.db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production")
    UPLOAD_DIR: str = os.path.join(os.getcwd(), "data", "uploads")

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
