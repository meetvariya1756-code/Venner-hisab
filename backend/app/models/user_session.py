from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Index
from app.core.database import Base


class UserSession(Base):
    """
    Server-side session store.

    Rules enforced:
    - One active session per user per device (device_id).
    - On re-login from same device, old session is invalidated before new one is created.
    - Expired / inactive sessions are cleaned up automatically on each login.
    - Token is a 64-char cryptographically secure random hex string.
    """
    __tablename__ = "user_sessions"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token        = Column(String(128), nullable=False, unique=True, index=True)
    device_id    = Column(String(128), nullable=True)   # Browser fingerprint (UUID from localStorage)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at   = Column(DateTime, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address   = Column(String(45), nullable=True)    # IPv4 or IPv6
    user_agent   = Column(String(512), nullable=True)
    is_active    = Column(Boolean, default=True, nullable=False)

    __table_args__ = (
        # Fast lookup: active sessions per user
        Index("ix_user_sessions_user_active", "user_id", "is_active"),
        # Fast lookup: active sessions per user per device
        Index("ix_user_sessions_device", "user_id", "device_id"),
        # Fast expiry sweeps
        Index("ix_user_sessions_expires", "expires_at"),
    )
