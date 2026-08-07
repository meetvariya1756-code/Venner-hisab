import os
import uuid
from typing import Optional, List, Dict, Any
from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException, Form, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, asc
from app.core.database import get_db
from app.core.config import settings
from app.models.account import BankAccount
from app.models.khatabook_entry import KhatabookEntry

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

        result_list.append({
            "id": acc.id,
            "name": acc.name,
            "account_holder": acc.account_holder or acc.name,
            "bank_name": acc.bank_name,
            "account_number": acc.masked_account_number,
            "phone_number": acc.phone_number,
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
    else:  # recent
        result_list.sort(key=lambda x: (x["last_activity_date"] != "No activity", x["last_activity_date"], x["id"]), reverse=True)

    return {
        "summary": {
            "total_give": round(total_give_overall, 2),
            "total_get": round(total_get_overall, 2),
            "accounts_count": len(result_list)
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

    return {
        "account": {
            "id": acc.id,
            "name": acc.name,
            "account_holder": acc.account_holder,
            "bank_name": acc.bank_name,
            "phone_number": acc.phone_number,
            "masked_account_number": acc.masked_account_number,
            "net_balance": round(net_balance, 2),
            "abs_net": round(abs(net_balance), 2),
            "status": status,
            "total_in": round(tot_got, 2),
            "total_out": round(tot_gave, 2)
        },
        "entries": processed_entries
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

    parsed_date = datetime.utcnow()
    if entry_date:
        try:
            parsed_date = datetime.strptime(entry_date.strip(), "%Y-%m-%d")
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
        try:
            entry.entry_date = datetime.strptime(entry_date.strip(), "%Y-%m-%d")
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


