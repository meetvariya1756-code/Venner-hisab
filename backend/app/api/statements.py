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

    # Save temp file for pdfplumber
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()

    # Auto-inject password from DB or fallback for FABREECART
    if not password and acc:
        if acc.pdf_password:
            password = acc.pdf_password
        elif acc.name and "FABREECART" in acc.name.upper():
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

    # Duplicate check
    year_month = parsing_result.year_month or "Unknown"
    is_dup, dup_msg = StatementService.check_duplicate(account_id, file_hash, year_month, db)

    return {
        "filename": file.filename,
        "file_hash": file_hash,
        "is_duplicate": is_dup,
        "duplicate_message": dup_msg,
        "account_id": account_id,
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
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    # Auto-inject password from DB or fallback for FABREECART
    if not password and acc:
        if acc.pdf_password:
            password = acc.pdf_password
        elif acc.name and "FABREECART" in acc.name.upper():
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

    # Check duplicate
    is_dup, dup_msg = StatementService.check_duplicate(account_id, file_hash, parsing_result.year_month or "", db)
    if is_dup:
        raise HTTPException(status_code=409, detail=dup_msg)

    stmt = StatementService.import_parsed_statement(
        account_id=account_id,
        filename=filename,
        file_hash=file_hash,
        parsing_result=parsing_result,
        db=db
    )

    return {
        "message": "Statement imported successfully",
        "statement_id": stmt.id,
        "transaction_count": stmt.transaction_count,
        "year_month": stmt.year_month
    }

