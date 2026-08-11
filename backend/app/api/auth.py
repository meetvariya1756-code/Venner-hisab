import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.user_session import UserSession

router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])

_LAST_SEEN_UPDATE_INTERVAL_SECONDS = 300  # 5 minutes


def _utcnow() -> datetime:
    """Helper to return current naive UTC datetime for database consistency."""
    return datetime.utcnow()


# ─────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str
    device_id: Optional[str] = None  # Browser UUID from localStorage


class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str  # "owner" or "manager"
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    role: str
    full_name: Optional[str] = None

    class Config:
        from_attributes = True


class LoginOut(BaseModel):
    success: bool
    session_token: str
    expires_at: str
    user: UserOut


# ─────────────────────────────────────────────────────────────
# Session helpers
# ─────────────────────────────────────────────────────────────

def _cleanup_expired_sessions(db: Session) -> None:
    """Delete sessions expired > 24 hours ago to keep table size optimized."""
    try:
        cutoff = _utcnow() - timedelta(hours=24)
        db.query(UserSession).filter(UserSession.expires_at < cutoff).delete(synchronize_session=False)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Session Cleanup Error] {e}", flush=True)


def _invalidate_existing_sessions(user_id: int, db: Session) -> None:
    """
    Invalidate ALL active sessions for this user on new login.
    Enforces strictly ONE active session per user across the entire application.
    """
    try:
        db.query(UserSession).filter(
            UserSession.user_id == user_id,
            UserSession.is_active == True,
        ).update({"is_active": False}, synchronize_session=False)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[Session Invalidation Error] {e}", flush=True)


def _create_session(
    user: User,
    request: Request,
    db: Session,
    device_id: Optional[str] = None,
) -> UserSession:
    """
    Create a new server-side session.
    Invalidates any previous active sessions for this user before creating a new one.
    """
    # 1. Deactivate existing active sessions for this user
    _invalidate_existing_sessions(user.id, db)

    # 2. Cleanup old sessions expired over 24h ago
    _cleanup_expired_sessions(db)

    # 3. Generate token & expiry
    token = secrets.token_hex(32)
    now = _utcnow()
    expires_at = now + timedelta(seconds=settings.SESSION_TTL_SECONDS)

    # 4. Extract IP & User Agent
    ip = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else None)
    )
    ua = request.headers.get("User-Agent", "")[:512]

    # 5. Insert new session row
    session = UserSession(
        user_id=user.id,
        token=token,
        device_id=device_id or "default_device",
        created_at=now,
        expires_at=expires_at,
        last_seen_at=now,
        ip_address=ip,
        user_agent=ua,
        is_active=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session(token: str, db: Session) -> Optional[UserSession]:
    """
    Validate a session token.
    Returns the active, non-expired session object or None.
    Updates last_seen_at lazily (at most once every 5 minutes).
    """
    now = _utcnow()
    session = (
        db.query(UserSession)
        .filter(
            UserSession.token == token,
            UserSession.is_active == True,
            UserSession.expires_at > now,
        )
        .first()
    )

    if session:
        try:
            last_seen = session.last_seen_at
            if last_seen.tzinfo is not None:
                last_seen = last_seen.replace(tzinfo=None)

            stale_threshold = now - timedelta(seconds=_LAST_SEEN_UPDATE_INTERVAL_SECONDS)
            if last_seen < stale_threshold:
                session.last_seen_at = now
                db.commit()
        except Exception as e:
            db.rollback()
            print(f"[Session Touch Error] {e}", flush=True)

    return session


def invalidate_session(token: str, db: Session) -> bool:
    """Mark a specific session as inactive (logout)."""
    try:
        updated = (
            db.query(UserSession)
            .filter(UserSession.token == token)
            .update({"is_active": False}, synchronize_session=False)
        )
        db.commit()
        return updated > 0
    except Exception as e:
        db.rollback()
        print(f"[Session Logout Error] {e}", flush=True)
        return False


# ─────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginOut)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    uname = payload.username.strip()
    pwd = payload.password.strip()

    user = db.query(User).filter(User.username == uname).first()
    if not user:
        user = db.query(User).filter(User.username.ilike(uname)).first()

    if not user or user.password != pwd:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Login ID or Password",
        )

    device_id = (payload.device_id or "").strip() or request.headers.get("X-Device-ID", "").strip() or None
    session = _create_session(user, request, db, device_id=device_id)

    return LoginOut(
        success=True,
        session_token=session.token,
        expires_at=session.expires_at.isoformat() + "Z",
        user=UserOut(
            id=user.id,
            username=user.username,
            role=user.role,
            full_name=user.full_name or user.username,
        ),
    )


@router.post("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    token = request.headers.get("X-Session-Token", "").strip()
    if token:
        invalidate_session(token, db)
    return {"success": True, "message": "Logged out successfully"}


@router.get("/validate")
def validate_session_endpoint(request: Request, db: Session = Depends(get_db)):
    token = request.headers.get("X-Session-Token", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="No session token provided")

    session = get_session(token, db)
    if not session:
        raise HTTPException(status_code=401, detail="Session expired or invalid")

    user = db.query(User).filter(User.id == session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return {
        "valid": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "full_name": user.full_name or user.username,
        },
        "expires_at": session.expires_at.isoformat() + "Z",
    }


@router.get("/users", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db)):
    return db.query(User).all()


@router.post("/users", response_model=UserOut)
def create_user(payload: UserCreateRequest, db: Session = Depends(get_db)):
    uname = payload.username.strip()
    role = payload.role.strip().lower()

    if role not in ["owner", "manager"]:
        raise HTTPException(status_code=400, detail="Role must be either 'owner' or 'manager'")

    existing = db.query(User).filter(User.username.ilike(uname)).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"User '{uname}' already exists")

    new_user = User(
        username=uname,
        password=payload.password.strip(),
        role=role,
        full_name=payload.full_name or uname,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
