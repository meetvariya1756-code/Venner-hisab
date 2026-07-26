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
    format: str = Query("xlsx", regex="^(xlsx|csv)$"),
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
