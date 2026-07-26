from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.platform import Platform
from app.schemas.schemas import PlatformCreate, PlatformOut

router = APIRouter(prefix="/platforms", tags=["Platforms"])

@router.get("", response_model=List[PlatformOut])
def get_platforms(db: Session = Depends(get_db)):
    platforms = db.query(Platform).all()
    res = []
    for p in platforms:
        out = PlatformOut.model_validate(p)
        out.account_count = len(p.accounts)
        res.append(out)
    return res

@router.post("", response_model=PlatformOut, status_code=status.HTTP_201_CREATED)
def create_platform(plat: PlatformCreate, db: Session = Depends(get_db)):
    existing = db.query(Platform).filter(Platform.name.ilike(plat.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Platform with this name already exists")

    db_plat = Platform(
        name=plat.name,
        code=plat.code or plat.name.upper(),
        description=plat.description
    )
    db.add(db_plat)
    db.commit()
    db.refresh(db_plat)
    out = PlatformOut.model_validate(db_plat)
    out.account_count = 0
    return out
