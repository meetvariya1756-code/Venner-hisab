from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.default_data import seed_default_data
from app.api import platforms, accounts, statements, transactions, categories, parties, rules, reports, export

# Create database tables
Base.metadata.create_all(bind=engine)

# Seed default data on startup
with SessionLocal() as db:
    seed_default_data(db)

app = FastAPI(
    title="Multi-Account Statement Analyzer API",
    description="E-Commerce Statement Analyzer & Transaction Ledger API",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(platforms.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(statements.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(parties.router, prefix="/api")
app.include_router(rules.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(export.router, prefix="/api")

@app.get("/")
def root():
    return {
        "app": "Multi-Account Statement Analyzer API",
        "status": "online",
        "docs": "/docs"
    }
