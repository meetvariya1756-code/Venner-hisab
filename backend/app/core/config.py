import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "Multi-Bank Accounting & Statement Analyzer"

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'accounting.db'}"

    # ── Security ──────────────────────────────────────────────
    SECRET_KEY: str = "dev-secret-key-replace-before-production"
    SESSION_TTL_SECONDS: int = 28800  # 8 hours

    # ── App ───────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"

    # ── File Uploads ──────────────────────────────────────────
    UPLOAD_DIR: str = str(BASE_DIR / "data" / "uploads")

    @property
    def origins_list(self) -> list[str]:
        origins = [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]
        if "*" in origins or self.ENVIRONMENT.lower() == "development":
            return ["*"]
        return origins

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"


settings = Settings()

# Normalise postgres:// → postgresql:// (Heroku/Render legacy URLs)
if settings.DATABASE_URL.startswith("postgres://"):
    settings.DATABASE_URL = settings.DATABASE_URL.replace("postgres://", "postgresql://", 1)

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
