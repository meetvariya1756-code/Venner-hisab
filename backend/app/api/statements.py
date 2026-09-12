import os
import shutil
import tempfile
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.account import BankAccount
from app.parsers.pdf_extractor import PasswordProtectedPDFException
from app.parsers.generic_parser import StatementParserEngine
from app.services.statement_service import StatementService

router = APIRouter(prefix="/statements", tags=["Statements"])
parser_engine = StatementParserEngine()

@router.post("/parse-preview")
async def parse_statement_preview(
    account_id: int = Form(...),
    password: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    file_hash = StatementService.calculate_file_hash(file_bytes)

    # Save temp file for parsing
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()

    # Auto-inject password from DB or fallback for FABREECART
    if not password and acc:
        if acc.pdf_password:
            password = acc.pdf_password
        elif acc.name and "FABREECART" in acc.name.replace(" ", "").replace("_", "").replace("-", "").upper():
            password = "VARIY09042006"

    try:
        parsing_result = parser_engine.parse_statement(tmp_path, password=password)
    except PasswordProtectedPDFException:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(
            status_code=401,
            detail="Password protected PDF statement. Please enter the password to decrypt."
        )
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse statement: {str(e)}")

    if os.path.exists(tmp_path):
        os.remove(tmp_path)

    # Calculate monthly breakdown and check duplicate status for each month
    breakdown = StatementService.get_monthly_breakdown_status(account_id, parsing_result, db)

    return {
        "filename": file.filename,
        "file_hash": file_hash,
        "is_duplicate": breakdown["is_all_duplicate"],
        "duplicate_message": breakdown["duplicate_message"],
        "account_id": account_id,
        "months_info": breakdown["months_info"],
        "new_months": breakdown["new_months"],
        "skipped_months": breakdown["skipped_months"],
        "parsing_result": parsing_result.model_dump()
    }

@router.post("/confirm-import")
async def confirm_statement_import(
    account_id: int = Form(...),
    filename: str = Form(...),
    file_hash: str = Form(...),
    password: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    file_bytes = await file.read()
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    store_name = acc.name if acc else "store"
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    # Auto-inject password from DB or fallback for FABREECART
    if not password and acc:
        if acc.pdf_password:
            password = acc.pdf_password
        elif acc.name and "FABREECART" in acc.name.replace(" ", "").replace("_", "").replace("-", "").upper():
            password = "VARIY09042006"

    try:
        parsing_result = parser_engine.parse_statement(tmp_path, password=password)
    except PasswordProtectedPDFException as pe:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        error_msg = str(pe) if str(pe) else "Password-protected PDF. Please enter the password."
        raise HTTPException(status_code=401, detail=error_msg)

    if os.path.exists(tmp_path):
        os.remove(tmp_path)

    # Check if all months are duplicates
    breakdown = StatementService.get_monthly_breakdown_status(account_id, parsing_result, db)
    if breakdown["is_all_duplicate"]:
        raise HTTPException(status_code=409, detail="This month's PDF has already been uploaded.")

    import_result = StatementService.import_parsed_statement(
        account_id=account_id,
        filename=filename,
        file_hash=file_hash,
        parsing_result=parsing_result,
        db=db,
        original_file_bytes=file_bytes,
        store_name=store_name
    )

    imported_stmts = import_result["imported_statements"]
    skipped_m = import_result["skipped_months"]

    if not imported_stmts:
        raise HTTPException(status_code=409, detail="This month's PDF has already been uploaded.")

    first_stmt = imported_stmts[0]
    total_tx_count = sum(s.transaction_count for s in imported_stmts)

    msg = f"Successfully imported {len(imported_stmts)} monthly statement(s)."
    if skipped_m:
        msg += f" Skipped existing month(s): {', '.join(skipped_m)}."

    return {
        "message": msg,
        "statement_id": first_stmt.id,
        "transaction_count": total_tx_count,
        "year_month": first_stmt.year_month,
        "imported_months": [s.year_month for s in imported_stmts],
        "skipped_months": skipped_m
    }

@router.get("")
@router.get("/")
def list_statements(
    account_id: Optional[int] = None,
    year_month: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from app.models.statement import Statement
    query = db.query(Statement)
    if account_id:
        query = query.filter(Statement.account_id == account_id)
    if year_month:
        query = query.filter(Statement.year_month == year_month)
    stmts = query.order_by(Statement.uploaded_at.desc()).all()
    return [
        {
            "id": s.id,
            "account_id": s.account_id,
            "filename": s.filename,
            "year_month": s.year_month,
            "start_date": s.start_date,
            "end_date": s.end_date,
            "opening_balance": s.opening_balance,
            "closing_balance": s.closing_balance,
            "total_credits": s.total_credits,
            "total_debits": s.total_debits,
            "transaction_count": s.transaction_count,
            "status": s.status,
            "uploaded_via_mobile": s.uploaded_via_mobile,
            "uploader_name": s.uploader_name,
            "uploaded_at": s.uploaded_at.isoformat() if s.uploaded_at else None,
            "has_file": bool(s.original_file_path and os.path.exists(s.original_file_path))
        }
        for s in stmts
    ]

@router.delete("/account/{account_id}/month/{year_month}")
def delete_statement_by_month(account_id: int, year_month: str, db: Session = Depends(get_db)):
    from app.models.statement import Statement
    from app.models.transaction import Transaction

    stmts = db.query(Statement).filter(
        Statement.account_id == account_id,
        Statement.year_month == year_month
    ).all()
    
    if not stmts:
        raise HTTPException(status_code=404, detail=f"No uploaded statement found for this account and period {year_month}.")

    count = 0
    for stmt in stmts:
        db.query(Transaction).filter(Transaction.statement_id == stmt.id).delete(synchronize_session=False)
        if stmt.original_file_path and os.path.exists(stmt.original_file_path):
            try:
                os.remove(stmt.original_file_path)
            except Exception as e:
                print(f"Warning: Failed to delete statement file from disk: {e}")
        db.delete(stmt)
        count += 1

    db.commit()
    return {"message": f"Successfully deleted {count} statement(s) and all associated transactions for period {year_month}."}

@router.delete("/{statement_id}")
def delete_statement(statement_id: int, db: Session = Depends(get_db)):
    from app.models.statement import Statement
    from app.models.transaction import Transaction

    stmt = db.query(Statement).filter(Statement.id == statement_id).first()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found.")
    
    db.query(Transaction).filter(Transaction.statement_id == stmt.id).delete(synchronize_session=False)

    if stmt.original_file_path and os.path.exists(stmt.original_file_path):
        try:
            os.remove(stmt.original_file_path)
        except Exception as e:
            print(f"Warning: Failed to delete statement file from disk: {e}")

    db.delete(stmt)
    db.commit()

    return {"message": "Statement and associated transactions deleted successfully."}

@router.get("/{statement_id}/download")
def download_statement_file(statement_id: int, db: Session = Depends(get_db)):
    from fastapi.responses import FileResponse
    from app.models.statement import Statement

    stmt = db.query(Statement).filter(Statement.id == statement_id).first()
    if not stmt or not stmt.original_file_path or not os.path.exists(stmt.original_file_path):
        raise HTTPException(status_code=404, detail="Original statement file not found.")
    return FileResponse(
        path=stmt.original_file_path,
        filename=os.path.basename(stmt.original_file_path),
        media_type="application/pdf"
    )

