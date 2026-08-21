import app.models  # noqa: F401 — ensure all models are registered before create_all
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.default_data import seed_default_data
from app.api import platforms, accounts, statements, transactions, categories, parties, rules, reports, export, mobile, auth, khatabook

# ── Create / migrate database tables ─────────────────────────
Base.metadata.create_all(bind=engine)

# Run simple migration to add columns to upi_screenshots if not exists
from sqlalchemy import text
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE upi_screenshots ADD COLUMN IF NOT EXISTS description VARCHAR(500)"))
        conn.execute(text("ALTER TABLE upi_screenshots ADD COLUMN IF NOT EXISTS target_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE SET NULL"))
        conn.execute(text("ALTER TABLE upi_screenshots ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION"))
        conn.execute(text("ALTER TABLE upi_screenshots ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20)"))
except Exception:
    # Columns already exist or table issue
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


@app.get("/")
def root():
    return {
        "app": "Multi-Account Statement Analyzer API",
        "status": "online",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs" if not settings.is_production else "disabled",
    }
