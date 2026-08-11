import secrets
from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.user_session import UserSession

router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])


# ─────────────────────────────────────────────────────────────
# Pydantic Schemas
# ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


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

def _create_session(user: User, request: Request, db: Session) -> UserSession:
    """
    Create a new server-side session row in user_sessions.
    Returns the session object (token + expiry attached).
    """
    token = secrets.token_hex(32)  # 64-char cryptographically secure token
    expires_at = datetime.utcnow() + timedelta(seconds=settings.SESSION_TTL_SECONDS)

    ip = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or (request.client.host if request.client else None)
    )
    ua = request.headers.get("User-Agent", "")[:512]

    session = UserSession(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        last_seen_at=datetime.utcnow(),
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
    Returns the session if valid and not expired; else None.
    """
    session = (
        db.query(UserSession)
        .filter(
            UserSession.token == token,
            UserSession.is_active == True,
            UserSession.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if session:
        session.last_seen_at = datetime.utcnow()
        db.commit()
    return session


def invalidate_session(token: str, db: Session) -> bool:
    """Mark a session as inactive (logout)."""
    session = db.query(UserSession).filter(UserSession.token == token).first()
    if session:
        session.is_active = False
        db.commit()
        return True
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

    session = _create_session(user, request, db)

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
    token = request.headers.get("X-Session-Token", "")
    if token and invalidate_session(token, db):
        return {"success": True, "message": "Logged out successfully"}
    return {"success": False, "message": "Session not found or already expired"}


@router.get("/validate")
def validate_session(request: Request, db: Session = Depends(get_db)):
    """
    Used by the frontend on page refresh to confirm the session is still valid.
    Returns user info if valid, 401 if not.
    """
    token = request.headers.get("X-Session-Token", "")
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
