import app.models  # noqa: F401 — ensure all models are registered before create_all
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.default_data import seed_default_data
from app.api import platforms, accounts, statements, transactions, categories, parties, rules, reports, export, mobile, auth, khatabook, chat

# ── Create / migrate database tables ─────────────────────────
Base.metadata.create_all(bind=engine)

# Run simple migration to add columns to tables if not exists
from sqlalchemy import text
try:
    with engine.begin() as conn:
        for col, col_type in [
            ("credit_limit", "FLOAT DEFAULT 0.0"),
            ("due_date", "TIMESTAMP"),
            ("upi_id", "VARCHAR(100)"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE bank_accounts ADD COLUMN {col} {col_type}"))
            except Exception:
                pass  # column already exists

        for col, col_type in [
            ("description", "VARCHAR(500)"),
            ("target_account_id", "INTEGER"),
            ("amount", "FLOAT"),
            ("entry_type", "VARCHAR(20)"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE upi_screenshots ADD COLUMN {col} {col_type}"))
            except Exception:
                pass  # column already exists
except Exception:
    pass

# ── Seed default data once on startup (idempotent) ────────────
with SessionLocal() as db:
    seed_default_data(db)

# ── FastAPI application ───────────────────────────────────────
app = FastAPI(
    title="Multi-Account Statement Analyzer API",
    description="E-Commerce Statement Analyzer & Mobile Upload Sync API",
    version="1.0.0",
    # Hide docs in production
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API Routers ───────────────────────────────────────────────
app.include_router(platforms.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(statements.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(parties.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(mobile.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(khatabook.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/")
def root():
    return {
        "app": "Multi-Account Statement Analyzer API",
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if not settings.is_production else "disabled",
    }
