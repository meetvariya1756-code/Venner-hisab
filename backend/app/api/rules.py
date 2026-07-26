from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.rule import CategorizationRule
from app.schemas.schemas import RuleCreate, RuleOut

router = APIRouter(prefix="/rules", tags=["Categorization Rules"])

@router.get("", response_model=List[RuleOut])
def get_rules(db: Session = Depends(get_db)):
    return db.query(CategorizationRule).order_by(CategorizationRule.priority.asc()).all()

@router.post("", response_model=RuleOut, status_code=status.HTTP_201_CREATED)
def create_rule(rule: RuleCreate, db: Session = Depends(get_db)):
    db_rule = CategorizationRule(
        name=rule.name,
        pattern=rule.pattern,
        match_type=rule.match_type,
        field=rule.field,
        party_id=rule.party_id,
        category_id=rule.category_id,
        priority=rule.priority,
        is_active=True
    )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.delete("/{rule_id}")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(CategorizationRule).filter(CategorizationRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"message": "Rule deleted successfully"}
