import os
import tempfile
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.account import BankAccount
from app.models.statement import Statement
from app.schemas.schemas import MobileAuthRequest, MobileAuthOut, AccountChecklistOut
from app.parsers.pdf_extractor import PasswordProtectedPDFException
from app.parsers.generic_parser import StatementParserEngine
from app.services.statement_service import StatementService

router = APIRouter(prefix="/mobile", tags=["Mobile App & Sync"])
parser_engine = StatementParserEngine()

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "statements")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/auth", response_model=MobileAuthOut)
def authenticate_mobile_store(payload: MobileAuthRequest, db: Session = Depends(get_db)):
    store_query = payload.store_name.strip()
    holder_query = payload.account_holder.strip() if payload.account_holder else ""
    code_query = payload.access_code.strip() if payload.access_code else ""

    acc = None
    # Search by Store Name
    accs = db.query(BankAccount).filter(BankAccount.name.ilike(store_query)).all()
    if not accs:
        accs = db.query(BankAccount).filter(BankAccount.name.ilike(f"%{store_query}%")).all()

    if accs:
        if holder_query:
            for a in accs:
                if a.account_holder and holder_query.lower() in a.account_holder.lower():
                    acc = a
                    break
        if not acc:
            acc = accs[0]

    if not acc and code_query:
        acc = db.query(BankAccount).filter(BankAccount.access_code.ilike(code_query)).first()

    if not acc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store Account '{store_query}' not found. Please check your Store Name and Account Holder Name."
        )

    return MobileAuthOut(
        store_id=acc.id,
        store_name=acc.name,
        account_holder=acc.account_holder,
        bank_name=acc.bank_name,
        account_number=acc.account_number,
        masked_account_number=acc.masked_account_number,
        account_type=acc.account_type,
        opening_balance=acc.opening_balance,
        currency=acc.currency,
        platform_name=acc.platform.name if acc.platform else "General",
        phone_number=acc.phone_number,
        pdf_password=acc.pdf_password
    )

@router.get("/statements/{account_id}")
def get_mobile_account_statements(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    stmts = db.query(Statement).filter(Statement.account_id == account_id).order_by(Statement.uploaded_at.desc()).all()
    return [{
        "id": s.id,
        "year_month": s.year_month,
        "filename": s.filename,
        "total_in": s.total_credits,
        "total_out": s.total_debits,
        "transaction_count": s.transaction_count,
        "uploaded_at": s.uploaded_at,
        "uploaded_via_mobile": s.uploaded_via_mobile or False
    } for s in stmts]

@router.post("/send-reminders")
def trigger_end_of_month_reminders(year_month: Optional[str] = None, db: Session = Depends(get_db)):
    if not year_month:
        today = datetime.now()
        year_month = today.strftime("%Y-%m")

    accounts = db.query(BankAccount).all()
    reminders = []

    for acc in accounts:
        stmt = db.query(Statement).filter(
            Statement.account_id == acc.id,
            Statement.year_month == year_month
        ).first()

        if not stmt:
            msg = f"Month-End Reminder for {acc.name} ({year_month}): Please upload your bank statement PDF for {acc.name} ({acc.bank_name})."
            reminders.append({
                "account_id": acc.id,
                "store_name": acc.name,
                "account_holder": acc.account_holder,
                "phone_number": acc.phone_number,
                "bank_name": acc.bank_name,
                "year_month": year_month,
                "message": msg
            })

    return {
        "success": True,
        "year_month": year_month,
        "pending_count": len(reminders),
        "reminders": reminders
    }

@router.post("/upload")
async def upload_statement_from_mobile(
    account_id: int = Form(...),
    year_month: str = Form(...),  # e.g. "2026-02"
    password: Optional[str] = Form(None),
    uploader_name: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Store account not found")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Empty PDF file uploaded")

    file_hash = StatementService.calculate_file_hash(file_bytes)

    # Save temp file for parsing
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
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF statement: {str(e)}")

    if os.path.exists(tmp_path):
        os.remove(tmp_path)

    # Check duplicate
    is_dup, dup_msg = StatementService.check_duplicate(account_id, file_hash, parsing_result.year_month or year_month, db)
    if is_dup:
        raise HTTPException(status_code=409, detail=dup_msg)

    # Save permanent PDF copy to disk
    store_slug = acc.name.replace(" ", "_").lower()
    save_filename = f"{store_slug}_{year_month}_{file_hash[:8]}.pdf"
    save_path = os.path.join(UPLOAD_DIR, save_filename)
    
    with open(save_path, "wb") as f:
        f.write(file_bytes)

    # Import statement & transactions into DB
    statement = StatementService.import_parsed_statement(
        account_id=account_id,
        filename=file.filename or save_filename,
        file_hash=file_hash,
        parsing_result=parsing_result,
        db=db
    )

    # Update mobile metadata & original file path
    statement.uploaded_via_mobile = True
    statement.original_file_path = save_path
    statement.uploader_name = uploader_name or acc.account_holder or "Store Account Holder"
    db.commit()

    return {
        "success": True,
        "message": f"Statement for {acc.name} ({year_month}) successfully uploaded and parsed!",
        "statement_id": statement.id,
        "transaction_count": statement.transaction_count,
        "total_in": statement.total_credits,
        "total_out": statement.total_debits
    }

@router.get("/checklist", response_model=List[AccountChecklistOut])
def get_monthly_upload_checklist(year_month: str = "2026-02", db: Session = Depends(get_db)):
    accounts = db.query(BankAccount).all()
    res = []

    for acc in accounts:
        stmt = db.query(Statement).filter(
            Statement.account_id == acc.id,
            Statement.year_month == year_month
        ).first()

        if stmt:
            res.append(AccountChecklistOut(
                account_id=acc.id,
                store_name=acc.name,
                account_holder=acc.account_holder,
                bank_name=acc.bank_name,
                platform_name=acc.platform.name if acc.platform else "General",
                access_code=acc.access_code,
                phone_number=acc.phone_number,
                status="RECEIVED",
                uploaded_via_mobile=stmt.uploaded_via_mobile or False,
                uploaded_at=stmt.uploaded_at,
                statement_id=stmt.id,
                filename=stmt.filename,
                total_in=stmt.total_credits,
                total_out=stmt.total_debits,
                transaction_count=stmt.transaction_count
            ))
        else:
            res.append(AccountChecklistOut(
                account_id=acc.id,
                store_name=acc.name,
                account_holder=acc.account_holder,
                bank_name=acc.bank_name,
                platform_name=acc.platform.name if acc.platform else "General",
                access_code=acc.access_code,
                phone_number=acc.phone_number,
                status="PENDING",
                uploaded_via_mobile=False
            ))

    return res

@router.get("/download/{statement_id}")
def download_original_statement_pdf(statement_id: int, db: Session = Depends(get_db)):
    stmt = db.query(Statement).filter(Statement.id == statement_id).first()
    if not stmt or not stmt.original_file_path or not os.path.exists(stmt.original_file_path):
        raise HTTPException(status_code=404, detail="Original PDF file not found")
    
    return FileResponse(
        path=stmt.original_file_path,
        filename=stmt.filename,
        media_type="application/pdf"
    )
