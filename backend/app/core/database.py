from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# ── Engine ────────────────────────────────────────────────────
engine = create_engine(
    settings.DATABASE_URL,
    # SQLite needs check_same_thread=False; PostgreSQL needs nothing special here
    connect_args={"check_same_thread": False} if _is_sqlite else {},
    # PostgreSQL connection pool settings (ignored for SQLite)
    pool_pre_ping=True,          # auto-reconnect on stale connections
    pool_size=5,                 # persistent connections
    max_overflow=10,             # extra burst connections
    echo=False                   # set True for SQL debug logging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a SQLAlchemy session and closes it after use."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
