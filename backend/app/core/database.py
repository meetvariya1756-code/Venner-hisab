import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings, BASE_DIR

def _build_engine(db_url: str):
    is_sqlite = db_url.startswith("sqlite")
    if is_sqlite:
        return create_engine(
            db_url,
            connect_args={"check_same_thread": False},
            echo=False
        )
    else:
        return create_engine(
            db_url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
            echo=False
        )

# Attempt connecting with configured DATABASE_URL
db_url = settings.DATABASE_URL
try:
    engine = _build_engine(db_url)
    # Test connection
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
except Exception as e:
    sqlite_path = str(BASE_DIR / "accounting.db").replace("\\", "/")
    fallback_url = f"sqlite:///{sqlite_path}"
    print(f"[DATABASE WARNING] Primary DB connection failed ({e}). Falling back to SQLite: {fallback_url}")
    engine = _build_engine(fallback_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a SQLAlchemy session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
