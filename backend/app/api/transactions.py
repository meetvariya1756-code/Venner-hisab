from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.category import Category
from app.models.party import Party
from app.models.rule import CategorizationRule
from app.schemas.schemas import TransactionOut, TransactionUpdate
from app.services.statement_service import StatementService

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("", response_model=List[TransactionOut])
def get_transactions(
    account_id: Optional[int] = None,
    statement_id: Optional[int] = None,
    category_id: Optional[int] = None,
    party_id: Optional[int] = None,
    is_categorized: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 500,
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if statement_id:
        query = query.filter(Transaction.statement_id == statement_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if party_id:
        query = query.filter(Transaction.party_id == party_id)
    if is_categorized is not None:
        query = query.filter(Transaction.is_categorized == is_categorized)
    if search:
        query = query.filter(Transaction.narration.ilike(f"%{search}%"))

    txs = query.order_by(Transaction.id.desc()).offset(skip).limit(limit).all()

    # Pre-fetch categories and parties for display names
    categories_map = {c.id: c.name for c in db.query(Category).all()}
    parties_map = {p.id: p.name for p in db.query(Party).all()}

    res = []
    for t in txs:
        out = TransactionOut.model_validate(t)
        out.category_name = categories_map.get(t.category_id) if t.category_id else "Uncategorized"
        out.party_name = parties_map.get(t.party_id) if t.party_id else None
        res.append(out)

    return res

@router.put("/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    db: Session = Depends(get_db)
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # If requested, create a new rule automatically
    if payload.create_rule and payload.pattern and payload.category_id:
        rule_name = payload.rule_name or f"Rule for {payload.pattern}"
        new_rule = CategorizationRule(
            name=rule_name,
            pattern=payload.pattern,
            match_type="KEYWORD",
            field="narration",
            party_id=payload.party_id,
            category_id=payload.category_id,
            priority=5,
            is_active=True
        )
        db.add(new_rule)
        db.commit()

    updated_tx = StatementService.update_transaction_category(
        transaction_id=transaction_id,
        category_id=payload.category_id,
        party_id=payload.party_id,
        user_info="manual_ui_user",
        db=db
    )

    out = TransactionOut.model_validate(updated_tx)
    if updated_tx.category:
        out.category_name = updated_tx.category.name
    if updated_tx.party:
        out.party_name = updated_tx.party.name

    return out
