import io
import pandas as pd
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.account import BankAccount
from app.models.category import Category
from app.models.party import Party

router = APIRouter(prefix="/export", tags=["Exports"])

@router.get("/transactions")
def export_transactions(
    format: str = Query("xlsx", pattern="^(xlsx|csv)$"),
    account_id: Optional[int] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)

    txs = query.order_by(Transaction.date.desc()).all()

    accounts_map = {a.id: a.name for a in db.query(BankAccount).all()}
    categories_map = {c.id: c.name for c in db.query(Category).all()}
    parties_map = {p.id: p.name for p in db.query(Party).all()}

    rows = []
    for t in txs:
        rows.append({
            "Transaction ID": t.id,
            "Account": accounts_map.get(t.account_id, "Unknown"),
            "Date": t.date,
            "Description": t.narration,
            "Ref / Chq No": t.ref_no or "",
            "Debit (Dr)": t.debit,
            "Credit (Cr)": t.credit,
            "Balance": t.balance,
            "Category": categories_map.get(t.category_id, "Uncategorized"),
            "Party / Payee": parties_map.get(t.party_id, ""),
            "Review Status": t.review_status,
            "Page": t.page_number
        })

    df = pd.DataFrame(rows)

    if format == "csv":
        output = io.StringIO()
        df.to_csv(output, index=False)
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8')),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=transactions_export.csv"}
        )
    else:
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Transactions", index=False)
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=transactions_export.xlsx"}
        )


@router.get("/backup/download")
def download_system_backup(db: Session = Depends(get_db)):
    """
    Exports a full JSON snapshot of accounts, khatabook entries, platforms, rules, and categories.
    """
    import json
    from datetime import datetime
    from app.models.platform import Platform
    from app.models.khatabook_entry import KhatabookEntry
    from app.models.rule import CategorizationRule

    backup_data = {
        "export_date": datetime.utcnow().isoformat(),
        "version": "1.0",
        "platforms": [{
            "id": p.id, "name": p.name, "code": p.code, "description": p.description
        } for p in db.query(Platform).all()],
        "accounts": [{
            "id": a.id, "name": a.name, "account_holder": a.account_holder, "bank_name": a.bank_name,
            "account_number": a.account_number, "phone_number": a.phone_number, "credit_limit": a.credit_limit,
            "due_date": a.due_date.isoformat() if a.due_date else None, "upi_id": a.upi_id, "opening_balance": a.opening_balance
        } for a in db.query(BankAccount).all()],
        "categories": [{
            "id": c.id, "name": c.name, "type": c.type, "color": c.color
        } for c in db.query(Category).all()],
        "parties": [{
            "id": p.id, "name": p.name, "category_id": p.category_id, "aliases": p.aliases
        } for p in db.query(Party).all()],
        "rules": [{
            "id": r.id, "name": r.name, "pattern": r.pattern, "match_type": r.match_type, "category_id": r.category_id, "party_id": r.party_id
        } for r in db.query(CategorizationRule).all()],
        "khatabook_entries": [{
            "id": k.id, "account_id": k.account_id, "entry_type": k.entry_type, "amount": k.amount,
            "description": k.description, "entry_date": k.entry_date.isoformat() if k.entry_date else None
        } for k in db.query(KhatabookEntry).all()]
    }

    json_str = json.dumps(backup_data, indent=2)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"Venner_Hisab_Backup_{timestamp}.json"

    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
