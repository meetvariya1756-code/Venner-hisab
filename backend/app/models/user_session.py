from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Index
from app.core.database import Base


class UserSession(Base):
    """
    Stores server-side login sessions for all users.

    A new row is inserted on every successful login.
    The session is invalidated (is_active=False) on logout or expiry.
    The token is a cryptographically secure random hex string (64 chars).
    """
    __tablename__ = "user_sessions"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token         = Column(String(128), nullable=False, unique=True, index=True)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at    = Column(DateTime, nullable=False)
    last_seen_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address    = Column(String(45), nullable=True)   # IPv4 or IPv6
    user_agent    = Column(String(512), nullable=True)
    is_active     = Column(Boolean, default=True, nullable=False)

    # ── Composite index: fast look-up of active sessions per user ──
    __table_args__ = (
        Index("ix_user_sessions_user_active", "user_id", "is_active"),
        Index("ix_user_sessions_expires", "expires_at"),
    )
