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
