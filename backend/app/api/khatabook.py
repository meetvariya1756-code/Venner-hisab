import os
import re
import uuid
import calendar
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, Form, UploadFile, File, Response, Body, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from app.core.database import get_db
from app.core.config import settings
from app.models.account import BankAccount
from app.models.platform import Platform
from app.models.khatabook_entry import KhatabookEntry
from app.schemas.schemas import SellEasePushRequest, SellEaseBatchPushRequest
from app.services.khatabook_pdf_service import generate_khatabook_ledger_pdf

router = APIRouter(prefix="/khatabook", tags=["Khatabook Ledger Management"])

BILLS_DIR = os.path.join(settings.UPLOAD_DIR, "bills")
os.makedirs(BILLS_DIR, exist_ok=True)


def format_entry_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "No activity"
    return dt.strftime("%d %b %Y • %I:%M %p")


@router.get("/summary")
def get_khatabook_summary(db: Session = Depends(get_db)):
    accounts = db.query(BankAccount).all()
    total_give = 0.0
    total_get = 0.0

    for acc in accounts:
        tot_gave = db.query(func.coalesce(func.sum(KhatabookEntry.amount), 0.0)).filter(
            KhatabookEntry.account_id == acc.id,
            KhatabookEntry.entry_type == "GAVE"
        ).scalar() or 0.0

        tot_got = db.query(func.coalesce(func.sum(KhatabookEntry.amount), 0.0)).filter(
            KhatabookEntry.account_id == acc.id,
            KhatabookEntry.entry_type == "GOT"
        ).scalar() or 0.0

        net = tot_got - tot_gave
        if net >= 0:
            total_get += net
        else:
            total_give += abs(net)

    return {
        "total_give": round(total_give, 2),
        "total_get": round(total_get, 2),
        "accounts_count": len(accounts)
    }


@router.get("/accounts")
def get_khatabook_accounts(
    q: Optional[str] = Query(None, description="Search by account/customer name or phone"),
    filter_by: str = Query("all", description="all, give, get"),
    sort_by: str = Query("recent", description="recent, highest, oldest"),
    db: Session = Depends(get_db)
):
    query = db.query(BankAccount)

    if q:
        search_term = f"%{q.strip()}%"
        query = query.filter(
            (BankAccount.name.ilike(search_term)) |
            (BankAccount.account_holder.ilike(search_term)) |
            (BankAccount.bank_name.ilike(search_term)) |
            (BankAccount.phone_number.ilike(search_term))
        )

    accounts = query.all()
    result_list = []

    total_give_overall = 0.0
    total_get_overall = 0.0

    for acc in accounts:
        tot_gave = db.query(func.coalesce(func.sum(KhatabookEntry.amount), 0.0)).filter(
            KhatabookEntry.account_id == acc.id,
            KhatabookEntry.entry_type == "GAVE"
        ).scalar() or 0.0

        tot_got = db.query(func.coalesce(func.sum(KhatabookEntry.amount), 0.0)).filter(
            KhatabookEntry.account_id == acc.id,
            KhatabookEntry.entry_type == "GOT"
        ).scalar() or 0.0

        tx_count = db.query(func.count(KhatabookEntry.id)).filter(
            KhatabookEntry.account_id == acc.id
        ).scalar() or 0

        latest_entry = db.query(KhatabookEntry).filter(
            KhatabookEntry.account_id == acc.id
        ).order_by(KhatabookEntry.entry_date.desc(), KhatabookEntry.id.desc()).first()

        earliest_entry = db.query(KhatabookEntry).filter(
            KhatabookEntry.account_id == acc.id
        ).order_by(KhatabookEntry.entry_date.asc(), KhatabookEntry.id.asc()).first()

        net_balance = tot_got - tot_gave
        status = "YOU'LL GET" if net_balance >= 0 else "YOU'LL GIVE"

        if net_balance >= 0:
            total_get_overall += net_balance
        else:
            total_give_overall += abs(net_balance)

        # Filter check
        f_lower = filter_by.lower()
        if f_lower == "give" and status != "YOU'LL GIVE":
            continue
        if f_lower == "get" and status != "YOU'LL GET":
            continue

        last_date_str = latest_entry.entry_date.strftime("%d %b %Y") if latest_entry else "No activity"
        first_date_str = earliest_entry.entry_date.strftime("%d %b %Y") if earliest_entry else "No activity"

        c_limit = float(getattr(acc, 'credit_limit', 0.0) or 0.0)
        due_dt = getattr(acc, 'due_date', None)
        upi_str = getattr(acc, 'upi_id', None) or ""

        # Overdue logic
        is_overdue = False
        days_overdue = 0
        now_dt = datetime.utcnow()
        if due_dt and abs(net_balance) > 0:
            if now_dt > due_dt:
                is_overdue = True
                days_overdue = (now_dt - due_dt).days

        # Credit utilization
        credit_used_pct = 0.0
        if c_limit > 0:
            credit_used_pct = round(min(100.0, (abs(net_balance) / c_limit) * 100.0), 1)

        # Aging bucket based on days since first activity or overdue
        aging_bucket = "0-30 days"
        if earliest_entry and abs(net_balance) > 0:
            diff_days = (now_dt - earliest_entry.entry_date).days
            if diff_days > 60 or days_overdue > 60:
                aging_bucket = "60+ days"
            elif diff_days > 30 or days_overdue > 30:
                aging_bucket = "31-60 days"

        result_list.append({
            "id": acc.id,
            "name": acc.name,
            "account_holder": acc.account_holder or acc.name,
            "bank_name": acc.bank_name,
            "account_number": acc.masked_account_number,
            "phone_number": acc.phone_number,
            "credit_limit": c_limit,
            "due_date": due_dt.strftime("%Y-%m-%d") if due_dt else None,
            "upi_id": upi_str,
            "is_overdue": is_overdue,
            "days_overdue": days_overdue,
            "credit_used_percent": credit_used_pct,
            "aging_bucket": aging_bucket,
            "total_in": round(tot_got, 2),
            "total_out": round(tot_gave, 2),
            "net_balance": round(net_balance, 2),
            "abs_net": round(abs(net_balance), 2),
            "status": status,
            "transaction_count": tx_count,
            "last_activity_date": last_date_str,
            "first_activity_date": first_date_str,
            "created_at": acc.created_at.strftime("%Y-%m-%d") if acc.created_at else "2026-01-01"
        })

    # Sort
    s_lower = sort_by.lower()
    if s_lower == "highest":
        result_list.sort(key=lambda x: x["abs_net"], reverse=True)
    elif s_lower == "oldest":
        result_list.sort(key=lambda x: (x["first_activity_date"] == "No activity", x["first_activity_date"], x["id"]))
    elif s_lower == "overdue":
        result_list.sort(key=lambda x: (x["is_overdue"], x["days_overdue"]), reverse=True)
    else:  # recent
        result_list.sort(key=lambda x: (x["last_activity_date"] != "No activity", x["last_activity_date"], x["id"]), reverse=True)

    # Calculate aging summaries
    aging_summary = {
        "days_0_30": sum(a["abs_net"] for a in result_list if a["aging_bucket"] == "0-30 days"),
        "days_31_60": sum(a["abs_net"] for a in result_list if a["aging_bucket"] == "31-60 days"),
        "days_60_plus": sum(a["abs_net"] for a in result_list if a["aging_bucket"] == "60+ days"),
        "overdue_count": sum(1 for a in result_list if a["is_overdue"])
    }

    return {
        "summary": {
            "total_give": round(total_give_overall, 2),
            "total_get": round(total_get_overall, 2),
            "accounts_count": len(result_list),
            "aging": aging_summary
        },
        "accounts": result_list
    }


@router.get("/accounts/{account_id}/entries")
def get_khatabook_account_entries(account_id: int, db: Session = Depends(get_db)):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    # Chronological order to calculate running balance accurately
    asc_entries = db.query(KhatabookEntry).filter(
        KhatabookEntry.account_id == account_id
    ).order_by(KhatabookEntry.entry_date.asc(), KhatabookEntry.id.asc()).all()

    running_bal = 0.0
    processed_entries = []

    for entry in asc_entries:
        if entry.entry_type == "GOT":
            running_bal += entry.amount
        else:
            running_bal -= entry.amount

        bill_url = f"/api/khatabook/bills/{os.path.basename(entry.bill_image_path)}" if entry.bill_image_path else None

        processed_entries.append({
            "id": entry.id,
            "account_id": entry.account_id,
            "entry_type": entry.entry_type,
            "amount": round(entry.amount, 2),
            "description": entry.description or "",
            "entry_date": entry.entry_date.strftime("%Y-%m-%d"),
            "formatted_date_time": format_entry_datetime(entry.entry_date),
            "running_balance": round(running_bal, 2),
            "you_gave": round(entry.amount, 2) if entry.entry_type == "GAVE" else 0.0,
            "you_got": round(entry.amount, 2) if entry.entry_type == "GOT" else 0.0,
            "bill_image_url": bill_url
        })

    # Return descending for reverse chronological UI display
    processed_entries.reverse()

    tot_gave = sum(e["you_gave"] for e in processed_entries)
    tot_got = sum(e["you_got"] for e in processed_entries)
    net_balance = tot_got - tot_gave
    status = "YOU'LL GET" if net_balance >= 0 else "YOU'LL GIVE"

    c_limit = float(getattr(acc, 'credit_limit', 0.0) or 0.0)
    due_dt = getattr(acc, 'due_date', None)
    upi_str = getattr(acc, 'upi_id', None) or ""

    is_overdue = False
    days_overdue = 0
    now_dt = datetime.utcnow()
    if due_dt and abs(net_balance) > 0 and now_dt > due_dt:
        is_overdue = True
        days_overdue = (now_dt - due_dt).days

    credit_used_pct = 0.0
    if c_limit > 0:
        credit_used_pct = round(min(100.0, (abs(net_balance) / c_limit) * 100.0), 1)

    return {
        "account": {
            "id": acc.id,
            "name": acc.name,
            "account_holder": acc.account_holder,
            "bank_name": acc.bank_name,
            "phone_number": acc.phone_number,
            "masked_account_number": acc.masked_account_number,
            "credit_limit": c_limit,
            "due_date": due_dt.strftime("%Y-%m-%d") if due_dt else None,
            "upi_id": upi_str,
            "is_overdue": is_overdue,
            "days_overdue": days_overdue,
            "credit_used_percent": credit_used_pct,
            "net_balance": round(net_balance, 2),
            "abs_net": round(abs(net_balance), 2),
            "status": status,
            "total_in": round(tot_got, 2),
            "total_out": round(tot_gave, 2)
        },
        "entries": processed_entries
    }


@router.put("/accounts/{account_id}/settings")
def update_khatabook_account_settings(
    account_id: int,
    credit_limit: Optional[float] = Form(None),
    due_date: Optional[str] = Form(None),
    upi_id: Optional[str] = Form(None),
    phone_number: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    if credit_limit is not None:
        acc.credit_limit = max(0.0, credit_limit)

    if due_date is not None:
        d_str = due_date.strip()
        if d_str == "" or d_str.lower() == "none":
            acc.due_date = None
        else:
            try:
                acc.due_date = datetime.strptime(d_str, "%Y-%m-%d")
            except ValueError:
                pass

    if upi_id is not None:
        acc.upi_id = upi_id.strip()

    if phone_number is not None:
        acc.phone_number = phone_number.strip()

    db.commit()
    return {
        "success": True,
        "account_id": acc.id,
        "credit_limit": acc.credit_limit,
        "due_date": acc.due_date.strftime("%Y-%m-%d") if acc.due_date else None,
        "upi_id": acc.upi_id,
        "phone_number": acc.phone_number
    }


@router.post("/parse-bill-receipt")
def parse_bill_receipt(
    file: UploadFile = File(...)
):
    """
    Analyzes an uploaded invoice/receipt image or PDF and extracts detected amount and date.
    """
    filename = file.filename or ""
    detected_amount = None
    detected_date = datetime.now().strftime("%Y-%m-%d")
    detected_description = ""

    # Check filename patterns for amount (e.g., "Bill_5000_15Mar.jpg", "Invoice-Rs2400.png")
    fn_amt_match = re.search(r'(?:rs|inr|amt|bill|₹)[_\-\s]*(\d+(?:[.,]\d{1,2})?)', filename, re.IGNORECASE)
    if fn_amt_match:
        try:
            detected_amount = float(fn_amt_match.group(1).replace(",", ""))
        except ValueError:
            pass

    # Read bytes to check text content if PDF or simple headers
    file_bytes = file.file.read()
    
    # Simple regex search across readable ASCII tokens in image/PDF
    try:
        raw_text = file_bytes.decode('latin-1', errors='ignore')
        if not detected_amount:
            amt_match = re.search(r'(?:Total|Grand Total|Net Amount|Amount Due|Paid Amount|Rs\.?|INR|₹)\s*[:=\-]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', raw_text, re.IGNORECASE)
            if amt_match:
                try:
                    cleaned = amt_match.group(1).replace(",", "")
                    val = float(cleaned)
                    if val > 0 and val < 10000000:
                        detected_amount = val
                except ValueError:
                    pass

        # Date pattern search
        dt_match = re.search(r'\b(\d{1,2})[-/](\d{1,2})[-/](20\d{2})\b', raw_text)
        if dt_match:
            try:
                d, m, y = dt_match.groups()
                detected_date = f"{y}-{m.zfill(2)}-{d.zfill(2)}"
            except Exception:
                pass
    except Exception:
        pass

    return {
        "success": True,
        "filename": filename,
        "detected_amount": detected_amount,
        "detected_date": detected_date,
        "detected_description": detected_description or f"Receipt: {os.path.splitext(filename)[0]}"
    }


@router.post("/accounts/{account_id}/entries")
def create_khatabook_entry(
    account_id: int,
    entry_type: str = Form(...),  # "GAVE" or "GOT"
    amount: float = Form(...),
    description: Optional[str] = Form(""),
    entry_date: Optional[str] = Form(None),
    bill_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    e_type = entry_type.strip().upper()
    if e_type not in ["GAVE", "GOT"]:
        raise HTTPException(status_code=400, detail="Invalid entry_type. Must be GAVE or GOT")

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    now = datetime.now()
    parsed_date = now
    if entry_date:
        entry_date_str = entry_date.strip()
        try:
            parsed_date = datetime.fromisoformat(entry_date_str)
        except ValueError:
            try:
                parsed_date = datetime.strptime(entry_date_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    parsed_date = datetime.strptime(entry_date_str, "%Y-%m-%d %H:%M")
                except ValueError:
                    try:
                        d = datetime.strptime(entry_date_str, "%Y-%m-%d").date()
                        if d == now.date():
                            parsed_date = datetime.combine(d, now.time())
                        else:
                            parsed_date = datetime.combine(d, datetime.min.time())
                    except ValueError:
                        pass

    bill_path = None
    if bill_file and bill_file.filename:
        ext = os.path.splitext(bill_file.filename)[1]
        unique_name = f"bill_{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(BILLS_DIR, unique_name)
        with open(save_path, "wb") as f:
            f.write(bill_file.file.read())
        bill_path = save_path

    new_entry = KhatabookEntry(
        account_id=account_id,
        entry_type=e_type,
        amount=amount,
        description=description,
        entry_date=parsed_date,
        bill_image_path=bill_path
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return {"success": True, "entry_id": new_entry.id}


@router.put("/entries/{entry_id}")
def update_khatabook_entry(
    entry_id: int,
    entry_type: Optional[str] = Form(None),
    amount: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    entry_date: Optional[str] = Form(None),
    bill_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    entry = db.query(KhatabookEntry).filter(KhatabookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if entry_type:
        e_type = entry_type.strip().upper()
        if e_type in ["GAVE", "GOT"]:
            entry.entry_type = e_type

    if amount is not None and amount > 0:
        entry.amount = amount

    if description is not None:
        entry.description = description

    if entry_date:
        entry_date_str = entry_date.strip()
        now = datetime.now()
        try:
            entry.entry_date = datetime.fromisoformat(entry_date_str)
        except ValueError:
            try:
                entry.entry_date = datetime.strptime(entry_date_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    entry.entry_date = datetime.strptime(entry_date_str, "%Y-%m-%d %H:%M")
                except ValueError:
                    try:
                        d = datetime.strptime(entry_date_str, "%Y-%m-%d").date()
                        if d == now.date():
                            entry.entry_date = datetime.combine(d, now.time())
                        else:
                            entry.entry_date = datetime.combine(d, datetime.min.time())
                    except ValueError:
                        pass

    if bill_file and bill_file.filename:
        ext = os.path.splitext(bill_file.filename)[1]
        unique_name = f"bill_{uuid.uuid4().hex}{ext}"
        save_path = os.path.join(BILLS_DIR, unique_name)
        with open(save_path, "wb") as f:
            f.write(bill_file.file.read())
        entry.bill_image_path = save_path

    db.commit()
    return {"success": True, "entry_id": entry.id}


@router.delete("/entries/{entry_id}")
def delete_khatabook_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(KhatabookEntry).filter(KhatabookEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    db.delete(entry)
    db.commit()
    return {"success": True, "deleted_id": entry_id}


@router.get("/bills/{filename}")
def get_bill_image(filename: str):
    file_path = os.path.join(BILLS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Bill image not found")
    return FileResponse(file_path)

@router.get("/screenshots")
def get_khatabook_screenshots(db: Session = Depends(get_db)):
    from app.models.upi_screenshot import UPIScreenshot
    accounts = db.query(BankAccount).all()
    result = []
    
    for acc in accounts:
        screenshots = db.query(UPIScreenshot).filter(UPIScreenshot.account_id == acc.id).order_by(UPIScreenshot.uploaded_at.desc()).all()
        if len(screenshots) > 0:
            result.append({
                "account_id": acc.id,
                "name": acc.name,
                "account_holder": acc.account_holder or acc.name,
                "screenshot_count": len(screenshots),
                "last_upload_date": screenshots[0].uploaded_at.strftime("%Y-%m-%d"),
                "last_upload_time": screenshots[0].uploaded_at.strftime("%I:%M %p"),
                "screenshots": [{
                    "id": s.id,
                    "filename": s.filename,
                    "upload_date": s.uploaded_at.strftime("%Y-%m-%d"),
                    "upload_time": s.uploaded_at.strftime("%I:%M %p"),
                    "description": s.description,
                    "image_url": f"/api/mobile/screenshots/file/{s.filename}"
                } for s in screenshots]
            })
            
    return result


@router.delete("/screenshots/{screenshot_id}")
def delete_khatabook_screenshot(screenshot_id: int, db: Session = Depends(get_db)):
    from app.models.upi_screenshot import UPIScreenshot
    screenshot = db.query(UPIScreenshot).filter(UPIScreenshot.id == screenshot_id).first()
    if not screenshot:
        raise HTTPException(status_code=404, detail="Screenshot not found")

    if screenshot.file_path and os.path.exists(screenshot.file_path):
        try:
            os.remove(screenshot.file_path)
        except Exception as e:
            print(f"Error removing file: {e}")

    db.delete(screenshot)
    db.commit()
    return {"success": True, "deleted_id": screenshot_id}


@router.get("/accounts/{account_id}/export/pdf")
def export_khatabook_account_pdf(
    account_id: int,
    period_type: str = Query("all", description="all, year, month, custom"),
    year: Optional[int] = Query(None, description="Year, e.g., 2026"),
    month: Optional[int] = Query(None, description="Month 1 to 12"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    acc = db.query(BankAccount).filter(BankAccount.id == account_id).first()
    if not acc:
        raise HTTPException(status_code=404, detail="Account not found")

    # 1. Fetch all entries chronologically to compute running balance correctly
    all_entries = db.query(KhatabookEntry).filter(
        KhatabookEntry.account_id == account_id
    ).order_by(KhatabookEntry.entry_date.asc(), KhatabookEntry.id.asc()).all()

    # Determine date bounds & period title
    p_type = (period_type or "all").lower().strip()
    filter_start: Optional[datetime] = None
    filter_end: Optional[datetime] = None
    period_title = "All Time"

    if p_type == "year" and year:
        filter_start = datetime(year, 1, 1, 0, 0, 0)
        filter_end = datetime(year, 12, 31, 23, 59, 59)
        period_title = f"Full Year {year}"
    elif p_type == "month" and year and month:
        _, last_day = calendar.monthrange(year, month)
        filter_start = datetime(year, month, 1, 0, 0, 0)
        filter_end = datetime(year, month, last_day, 23, 59, 59)
        month_name = calendar.month_name[month]
        period_title = f"{month_name} {year}"
    elif p_type == "custom" and start_date and end_date:
        try:
            s_dt = datetime.strptime(start_date.strip(), "%Y-%m-%d")
            e_dt = datetime.strptime(end_date.strip(), "%Y-%m-%d")
            filter_start = datetime(s_dt.year, s_dt.month, s_dt.day, 0, 0, 0)
            filter_end = datetime(e_dt.year, e_dt.month, e_dt.day, 23, 59, 59)
            period_title = f"{filter_start.strftime('%d %b %Y')} to {filter_end.strftime('%d %b %Y')}"
        except ValueError:
            pass

    running_bal = 0.0
    filtered_entries = []
    tot_gave_period = 0.0
    tot_got_period = 0.0

    for entry in all_entries:
        if entry.entry_type == "GOT":
            running_bal += entry.amount
        else:
            running_bal -= entry.amount

        # Check date filter
        e_date = entry.entry_date
        if filter_start and e_date < filter_start:
            continue
        if filter_end and e_date > filter_end:
            continue

        gave_val = round(entry.amount, 2) if entry.entry_type == "GAVE" else 0.0
        got_val = round(entry.amount, 2) if entry.entry_type == "GOT" else 0.0

        tot_gave_period += gave_val
        tot_got_period += got_val

        filtered_entries.append({
            "id": entry.id,
            "account_id": entry.account_id,
            "entry_type": entry.entry_type,
            "amount": round(entry.amount, 2),
            "description": entry.description or "",
            "entry_date": entry.entry_date.strftime("%d %b %Y"),
            "formatted_date_time": format_entry_datetime(entry.entry_date),
            "running_balance": round(running_bal, 2),
            "you_gave": gave_val,
            "you_got": got_val,
        })

    # Summary calculations
    net_bal = tot_got_period - tot_gave_period
    status = "YOU'LL GET" if net_bal >= 0 else "YOU'LL GIVE"

    summary_info = {
        "total_gave": round(tot_gave_period, 2),
        "total_got": round(tot_got_period, 2),
        "net_balance": round(net_bal, 2),
        "abs_net": round(abs(net_bal), 2),
        "status": status,
        "count": len(filtered_entries)
    }

    # Generate PDF binary
    pdf_bytes = generate_khatabook_ledger_pdf(
        account=acc,
        entries=filtered_entries,
        period_title=period_title,
        summary=summary_info
    )

    safe_name = "".join(c for c in acc.name if c.isalnum() or c in (" ", "_", "-")).rstrip().replace(" ", "_")
    safe_period = period_title.replace(" ", "_").replace("/", "-")
    filename = f"Khatabook_{safe_name}_{safe_period}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


@router.get("/export/pdf")
def export_all_khatabook_pdf(
    period_type: str = Query("all", description="all, year, month, custom"),
    year: Optional[int] = Query(None, description="Year, e.g., 2026"),
    month: Optional[int] = Query(None, description="Month 1 to 12"),
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    # 1. Fetch all entries across all accounts
    all_entries = db.query(KhatabookEntry).order_by(
        KhatabookEntry.entry_date.asc(), KhatabookEntry.id.asc()
    ).all()

    # Determine date bounds & period title
    p_type = (period_type or "all").lower().strip()
    filter_start: Optional[datetime] = None
    filter_end: Optional[datetime] = None
    period_title = "All Time"

    if p_type == "year" and year:
        filter_start = datetime(year, 1, 1, 0, 0, 0)
        filter_end = datetime(year, 12, 31, 23, 59, 59)
        period_title = f"Full Year {year}"
    elif p_type == "month" and year and month:
        _, last_day = calendar.monthrange(year, month)
        filter_start = datetime(year, month, 1, 0, 0, 0)
        filter_end = datetime(year, month, last_day, 23, 59, 59)
        month_name = calendar.month_name[month]
        period_title = f"{month_name} {year}"
    elif p_type == "custom" and start_date and end_date:
        try:
            s_dt = datetime.strptime(start_date.strip(), "%Y-%m-%d")
            e_dt = datetime.strptime(end_date.strip(), "%Y-%m-%d")
            filter_start = datetime(s_dt.year, s_dt.month, s_dt.day, 0, 0, 0)
            filter_end = datetime(e_dt.year, e_dt.month, e_dt.day, 23, 59, 59)
            period_title = f"{filter_start.strftime('%d %b %Y')} to {filter_end.strftime('%d %b %Y')}"
        except ValueError:
            pass

    running_bal = 0.0
    filtered_entries = []
    tot_gave_period = 0.0
    tot_got_period = 0.0

    acc_map = {a.id: a for a in db.query(BankAccount).all()}

    for entry in all_entries:
        if entry.entry_type == "GOT":
            running_bal += entry.amount
        else:
            running_bal -= entry.amount

        # Check date filter
        e_date = entry.entry_date
        if filter_start and e_date < filter_start:
            continue
        if filter_end and e_date > filter_end:
            continue

        gave_val = round(entry.amount, 2) if entry.entry_type == "GAVE" else 0.0
        got_val = round(entry.amount, 2) if entry.entry_type == "GOT" else 0.0

        tot_gave_period += gave_val
        tot_got_period += got_val

        acc_obj = acc_map.get(entry.account_id)
        acc_label = f"[{acc_obj.name}] " if acc_obj else ""
        desc_text = f"{acc_label}{entry.description or ''}".strip()

        filtered_entries.append({
            "id": entry.id,
            "account_id": entry.account_id,
            "entry_type": entry.entry_type,
            "amount": round(entry.amount, 2),
            "description": desc_text,
            "entry_date": entry.entry_date.strftime("%d %b %Y"),
            "formatted_date_time": format_entry_datetime(entry.entry_date),
            "running_balance": round(running_bal, 2),
            "you_gave": gave_val,
            "you_got": got_val,
        })

    net_bal = tot_got_period - tot_gave_period
    status = "YOU'LL GET" if net_bal >= 0 else "YOU'LL GIVE"

    summary_info = {
        "total_gave": round(tot_gave_period, 2),
        "total_got": round(tot_got_period, 2),
        "net_balance": round(net_bal, 2),
        "abs_net": round(abs(net_bal), 2),
        "status": status,
        "count": len(filtered_entries)
    }

    # Consolidated pseudo-account
    dummy_acc = type("ConsolidatedAccount", (), {
        "name": "All Accounts (Consolidated)",
        "account_holder": f"{len(acc_map)} Accounts",
        "bank_name": "Multi-Account Master Ledger",
        "phone_number": "Consolidated Statement",
        "masked_account_number": "ALL-ACCOUNTS"
    })()

    pdf_bytes = generate_khatabook_ledger_pdf(
        account=dummy_acc,
        entries=filtered_entries,
        period_title=period_title,
        summary=summary_info
    )

    safe_period = period_title.replace(" ", "_").replace("/", "-")
    filename = f"Khatabook_All_Accounts_{safe_period}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )


# ── SellEase Integration Endpoints ─────────────────────────────────────────────

def _parse_flexible_entry_date(date_str: Optional[str]) -> datetime:
    if not date_str:
        return datetime.now()
    
    s = str(date_str).strip()
    try:
        return datetime.fromisoformat(s)
    except Exception:
        pass

    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y %H:%M",
        "%d-%m-%Y",
        "%d/%m/%Y %H:%M:%S",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y/%m/%d",
        "%d.%m.%Y",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            continue

    return datetime.now()


def _process_single_sellease_entry(entry_req: SellEasePushRequest, db: Session) -> Dict[str, Any]:
    account_name = (entry_req.account or "").strip()
    if not account_name:
        raise HTTPException(status_code=400, detail="Account name is required in SellEase payload")

    if not entry_req.products or len(entry_req.products) == 0:
        raise HTTPException(status_code=400, detail="At least one product item is required")

    # 1. Match or auto-create account
    acc = db.query(BankAccount).filter(
        (BankAccount.name.ilike(account_name)) |
        (BankAccount.account_holder.ilike(account_name))
    ).first()

    if not acc:
        if entry_req.auto_create_account:
            # Find default platform for SellEase / Direct Party
            platform = db.query(Platform).filter(
                (Platform.name.ilike("%SellEase%")) |
                (Platform.code == "OTHER") |
                (Platform.name.ilike("%Direct Party%"))
            ).first()
            if not platform:
                platform = db.query(Platform).first()

            acc = BankAccount(
                name=account_name,
                account_holder=account_name,
                bank_name="SellEase Customer Account",
                account_number=f"SE-{uuid.uuid4().hex[:6].upper()}",
                platform_id=platform.id if platform else None,
                opening_balance=0.0
            )
            db.add(acc)
            db.commit()
            db.refresh(acc)
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Account '{account_name}' not found in Khatabook and auto_create_account is False"
            )

    # 2. Build itemized description & strictly validate totals
    parsed_date = _parse_flexible_entry_date(entry_req.date)
    desc_lines = []
    calculated_total = 0.0
    total_qty = 0.0

    if entry_req.order_id:
        desc_lines.append(f"📦 Order/Batch: {entry_req.order_id}")

    for idx, p in enumerate(entry_req.products):
        p_name = p.product_name.strip() if p.product_name else ""
        if not p_name:
            raise HTTPException(status_code=400, detail=f"Product at index {idx} must have a valid product_name")

        qty = float(p.quantity or 0)
        if qty <= 0:
            raise HTTPException(status_code=400, detail=f"Product '{p_name}' quantity must be greater than 0")

        unit_price = float(p.price or 0)
        if unit_price <= 0:
            raise HTTPException(status_code=400, detail=f"Product '{p_name}' price must be greater than 0")

        line_tot = round(float(p.total) if p.total is not None else (qty * unit_price), 2)
        if line_tot <= 0:
            raise HTTPException(status_code=400, detail=f"Product '{p_name}' line total must be greater than 0")

        calculated_total += line_tot
        total_qty += qty

        qty_str = f"{int(qty)}" if qty.is_integer() else f"{qty:g}"
        price_str = f"{int(unit_price)}" if unit_price.is_integer() else f"{unit_price:g}"
        desc_lines.append(f"{p_name}: {qty_str} pcs × ₹{price_str} = ₹{line_tot:,.2f}")

    if entry_req.grand_total is None or float(entry_req.grand_total) <= 0:
        raise HTTPException(status_code=400, detail="grand_total is required and must be greater than 0")

    final_grand_total = round(float(entry_req.grand_total), 2)

    desc_lines.append("───────────────────────────────")
    total_qty_str = f"{int(total_qty)}" if total_qty.is_integer() else f"{total_qty:g}"
    desc_lines.append(f"Total Qty: {total_qty_str} pcs | Grand Total: ₹{final_grand_total:,.2f}")

    if entry_req.notes:
        desc_lines.append(f"Note: {entry_req.notes.strip()}")

    full_description = "\n".join(desc_lines)

    # 3. Create entry
    raw_type = (entry_req.entry_type or "GAVE").strip().upper()
    if "GAV" in raw_type or "GIV" in raw_type:
        e_type = "GAVE"
    elif "GOT" in raw_type or "GET" in raw_type or "REC" in raw_type:
        e_type = "GOT"
    else:
        e_type = "GAVE"

    new_entry = KhatabookEntry(
        account_id=acc.id,
        entry_type=e_type,
        amount=final_grand_total,
        description=full_description,
        entry_date=parsed_date
    )
    db.add(new_entry)
    db.commit()
    db.refresh(new_entry)

    return {
        "entry_id": new_entry.id,
        "account_id": acc.id,
        "account_name": acc.name,
        "entry_type": new_entry.entry_type,
        "entry_date": new_entry.entry_date.strftime("%Y-%m-%d"),
        "grand_total": final_grand_total,
        "total_quantity": total_qty,
        "item_count": len(entry_req.products),
        "description": full_description
    }


@router.post("/sellease-push", status_code=status.HTTP_201_CREATED)
def push_sellease_entry(
    payload: SellEasePushRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    Receives sales & dispatched product data from SellEase (or Label Print automation)
    and automatically creates the corresponding ledger entry in Khatabook.
    """
    res = _process_single_sellease_entry(payload, db)
    return {
        "success": True,
        "message": f"Successfully created Khatabook entry for account '{res['account_name']}' with total ₹{res['grand_total']:,.2f}",
        "data": res
    }


@router.post("/sellease-batch-push", status_code=status.HTTP_201_CREATED)
def push_sellease_batch_entries(
    payload: SellEaseBatchPushRequest = Body(...),
    db: Session = Depends(get_db)
):
    """
    Receives a batch of sales/label entries from SellEase and creates Khatabook entries for all accounts.
    """
    results = []
    errors = []

    for idx, entry in enumerate(payload.entries):
        try:
            res = _process_single_sellease_entry(entry, db)
            results.append(res)
        except Exception as e:
            errors.append({
                "index": idx,
                "account": entry.account,
                "error": str(e)
            })

    return {
        "success": len(errors) == 0,
        "total_received": len(payload.entries),
        "total_processed": len(results),
        "total_errors": len(errors),
        "processed_entries": results,
        "errors": errors
    }
