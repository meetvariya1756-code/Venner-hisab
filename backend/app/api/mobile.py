import os
import re
import tempfile
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.account import BankAccount
from app.models.statement import Statement
from app.models.upi_screenshot import UPIScreenshot
from app.schemas.schemas import MobileAuthRequest, MobileAuthOut, AccountChecklistOut
from app.parsers.pdf_extractor import PasswordProtectedPDFException
from app.parsers.generic_parser import StatementParserEngine
from app.services.statement_service import StatementService

router = APIRouter(prefix="/mobile", tags=["Mobile App & Sync"])
parser_engine = StatementParserEngine()

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "statements")
os.makedirs(UPLOAD_DIR, exist_ok=True)

SCREENSHOTS_DIR = os.path.join(settings.UPLOAD_DIR, "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

def normalize_text(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r'[^a-zA-Z0-9]', '', str(s)).lower()

@router.post("/auth", response_model=MobileAuthOut)
def authenticate_mobile_store(payload: MobileAuthRequest, db: Session = Depends(get_db)):
    store_query = payload.store_name.strip()
    holder_query = payload.account_holder.strip() if payload.account_holder else ""
    code_query = payload.access_code.strip() if payload.access_code else ""

    norm_store = normalize_text(store_query)
    norm_holder = normalize_text(holder_query)
    norm_code = normalize_text(code_query)

    all_accs = db.query(BankAccount).all()
    scored_matches = []

    for a in all_accs:
        a_name = normalize_text(a.name)
        a_holder = normalize_text(a.account_holder)
        a_code = normalize_text(a.access_code)
        a_phone = normalize_text(a.phone_number)

        score = 0

        # Match store_query against store name, holder, code, phone
        if norm_store:
            if norm_store == a_name:
                score += 60
            elif a_name and (norm_store in a_name or a_name in norm_store):
                score += 40
            elif norm_store == a_holder:
                score += 35
            elif a_holder and (norm_store in a_holder or a_holder in norm_store):
                score += 25
            elif a_code and (norm_store == a_code or norm_store in a_code):
                score += 35
            elif a_phone and (norm_store == a_phone or norm_store in a_phone):
                score += 30

        # Match holder_query against account holder name or store name
        if norm_holder:
            if norm_holder == a_holder:
                score += 50
            elif a_holder and (norm_holder in a_holder or a_holder in norm_holder):
                score += 35
            elif norm_holder == a_name:
                score += 30
            elif a_name and (norm_holder in a_name or a_name in norm_holder):
                score += 25

        # Match code_query
        if norm_code:
            if a_code and (norm_code == a_code or norm_code in a_code):
                score += 50

        if score > 0:
            scored_matches.append((score, a))

    acc = None
    if scored_matches:
        scored_matches.sort(key=lambda x: x[0], reverse=True)
        acc = scored_matches[0][1]

    if not acc and (code_query or store_query):
        search_term = code_query or store_query
        acc = db.query(BankAccount).filter(BankAccount.access_code.ilike(f"%{search_term}%")).first()

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
        elif acc.name and "FABREECART" in acc.name.replace(" ", "").replace("_", "").replace("-", "").upper():
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

    # Check duplicate status across parsed months
    breakdown = StatementService.get_monthly_breakdown_status(account_id, parsing_result, db)
    if breakdown["is_all_duplicate"]:
        raise HTTPException(status_code=409, detail="This month's PDF has already been uploaded.")

    uploader = uploader_name or acc.account_holder or "Store Account Holder"

    # Import statement & transactions into DB with monthly auto-splitting
    import_result = StatementService.import_parsed_statement(
        account_id=account_id,
        filename=file.filename or "statement.pdf",
        file_hash=file_hash,
        parsing_result=parsing_result,
        db=db,
        uploader_name=uploader,
        uploaded_via_mobile=True,
        original_file_bytes=file_bytes,
        store_name=acc.name
    )

    imported_stmts = import_result["imported_statements"]
    skipped_m = import_result["skipped_months"]

    if not imported_stmts:
        raise HTTPException(status_code=409, detail="This month's PDF has already been uploaded.")

    first_stmt = imported_stmts[0]
    total_tx_count = sum(s.transaction_count for s in imported_stmts)
    total_in = sum(s.total_credits for s in imported_stmts)
    total_out = sum(s.total_debits for s in imported_stmts)

    msg = f"Statement for {acc.name} ({', '.join([s.year_month for s in imported_stmts])}) successfully uploaded and parsed!"
    if skipped_m:
        msg += f" Existing month(s) skipped: {', '.join(skipped_m)}."

    return {
        "success": True,
        "message": msg,
        "statement_id": first_stmt.id,
        "transaction_count": total_tx_count,
        "total_in": total_in,
        "total_out": total_out,
        "imported_months": [s.year_month for s in imported_stmts],
        "skipped_months": skipped_m
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

@router.post("/screenshots/upload")
async def upload_upi_screenshot(
    account_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="BankAccount not found")
    
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(status_code=400, detail="Invalid file format. Only PNG, JPG, JPEG, and WEBP are supported.")
    
    import uuid
    unique_filename = f"upi_{uuid.uuid4().hex}{ext}"
    save_path = os.path.join(SCREENSHOTS_DIR, unique_filename)
    
    file_bytes = await file.read()
    with open(save_path, "wb") as f:
        f.write(file_bytes)
    
    screenshot = UPIScreenshot(
        account_id=account_id,
        filename=unique_filename,
        file_path=save_path,
        uploaded_at=datetime.utcnow()
    )
    db.add(screenshot)
    db.commit()
    db.refresh(screenshot)
    
    return {
        "success": True,
        "id": screenshot.id,
        "filename": screenshot.filename,
        "upload_date": screenshot.uploaded_at.strftime("%Y-%m-%d"),
        "upload_time": screenshot.uploaded_at.strftime("%I:%M %p"),
    }

@router.get("/screenshots/{account_id}")
def get_mobile_screenshots(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")
    
    screenshots = db.query(UPIScreenshot).filter(UPIScreenshot.account_id == account_id).order_by(UPIScreenshot.uploaded_at.desc()).all()
    return [{
        "id": s.id,
        "filename": s.filename,
        "upload_date": s.uploaded_at.strftime("%Y-%m-%d"),
        "upload_time": s.uploaded_at.strftime("%I:%M %p"),
        "image_url": f"/api/mobile/screenshots/file/{s.filename}"
    } for s in screenshots]

@router.get("/screenshots/file/{filename}")
def get_screenshot_file(filename: str):
    file_path = os.path.join(SCREENSHOTS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Screenshot file not found")
    return FileResponse(file_path)
