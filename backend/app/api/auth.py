from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["Authentication & User Management"])

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreateRequest(BaseModel):
    username: str
    password: str
    role: str # "owner" or "manager"
    full_name: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    full_name: Optional[str] = None

    class Config:
        from_attributes = True

@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    uname = payload.username.strip()
    pwd = payload.password.strip()

    user = db.query(User).filter(User.username == uname).first()

    # Fallback matching for exact case or case-insensitive matching
    if not user:
        user = db.query(User).filter(User.username.ilike(uname)).first()

    if not user or user.password != pwd:
        # Fallback check for legacy hardcoded Owner credentials
        if uname == "Venner Enterprise" and pwd == "Venner@Enterprise":
            return {
                "success": True,
                "user": {
                    "id": 1,
                    "username": "Venner Enterprise",
                    "role": "owner",
                    "full_name": "Venner Enterprise Owner"
                }
            }
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Login ID or Password"
        )

    return {
        "success": True,
        "user": {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "full_name": user.full_name or user.username
        }
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
        full_name=payload.full_name or uname
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
