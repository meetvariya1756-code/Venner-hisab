from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.account import BankAccount
from app.schemas.schemas import AccountCreate, AccountOut

router = APIRouter(prefix="/accounts", tags=["Bank Accounts"])

@router.get("", response_model=List[AccountOut])
def get_accounts(
    platform_id: Optional[int] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(BankAccount)
    if platform_id:
        query = query.filter(BankAccount.platform_id == platform_id)

    accounts = query.all()
    res = []
    for a in accounts:
        out = AccountOut.model_validate(a)
        out.masked_account_number = a.masked_account_number
        out.platform_name = a.platform.name if a.platform else "General"
        res.append(out)
    return res

@router.post("", response_model=AccountOut, status_code=status.HTTP_201_CREATED)
def create_account(acc: AccountCreate, db: Session = Depends(get_db)):
    db_acc = BankAccount(
        platform_id=acc.platform_id,
        name=acc.name.strip(),
        account_holder=acc.account_holder.strip() if acc.account_holder else None,
        bank_name=acc.bank_name.strip(),
        account_number=acc.account_number.strip(),
        account_type=acc.account_type,
        opening_balance=acc.opening_balance,
        currency=acc.currency,
        phone_number=acc.phone_number.strip() if acc.phone_number else None,
        pdf_password=acc.pdf_password.strip() if acc.pdf_password else None
    )
    db.add(db_acc)
    db.commit()
    db.refresh(db_acc)
    out = AccountOut.model_validate(db_acc)
    out.masked_account_number = db_acc.masked_account_number
    out.platform_name = db_acc.platform.name if db_acc.platform else "General"
    return out

@router.put("/{account_id}", response_model=AccountOut)
def update_account(account_id: int, acc: AccountCreate, db: Session = Depends(get_db)):
    db_acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not db_acc:
        raise HTTPException(status_code=404, detail="Account not found")

    db_acc.platform_id = acc.platform_id
    db_acc.name = acc.name.strip()
    db_acc.account_holder = acc.account_holder.strip() if acc.account_holder else None
    db_acc.bank_name = acc.bank_name.strip()
    db_acc.account_number = acc.account_number.strip()
    db_acc.account_type = acc.account_type
    db_acc.opening_balance = acc.opening_balance
    db_acc.phone_number = acc.phone_number.strip() if acc.phone_number else None
    db_acc.pdf_password = acc.pdf_password.strip() if acc.pdf_password else None

    db.commit()
    db.refresh(db_acc)

    out = AccountOut.model_validate(db_acc)
    out.masked_account_number = db_acc.masked_account_number
    out.platform_name = db_acc.platform.name if db_acc.platform else "General"
    return out

@router.delete("/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(acc)
    db.commit()
    return {"message": "Account deleted successfully"}
