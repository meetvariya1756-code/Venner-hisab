from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.party import Party
from app.schemas.schemas import PartyCreate, PartyOut, PartyMergeRequest
from app.services.party_service import PartyService

router = APIRouter(prefix="/parties", tags=["Parties"])

@router.get("", response_model=List[PartyOut])
def get_parties(db: Session = Depends(get_db)):
    return db.query(Party).all()

@router.post("", response_model=PartyOut, status_code=status.HTTP_201_CREATED)
def create_party(party: PartyCreate, db: Session = Depends(get_db)):
    import json
    db_party = Party(
        name=party.name,
        category_id=party.category_id,
        aliases=json.dumps(party.aliases or [])
    )
    db.add(db_party)
    db.commit()
    db.refresh(db_party)
    return db_party

@router.post("/merge", response_model=PartyOut)
def merge_parties(req: PartyMergeRequest, db: Session = Depends(get_db)):
    try:
        merged = PartyService.merge_parties(req.source_party_ids, req.target_party_id, db)
        return merged
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
