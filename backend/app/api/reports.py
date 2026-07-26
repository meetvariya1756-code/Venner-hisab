from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.report_service import ReportService

router = APIRouter(prefix="/reports", tags=["Reports & Dashboard"])

@router.get("/dashboard")
def get_dashboard_data(
    year_month: Optional[str] = Query(None, description="Format YYYY-MM"),
    db: Session = Depends(get_db)
):
    return ReportService.get_consolidated_dashboard(year_month, db)

@router.get("/platform-breakdown")
def get_platform_breakdown(db: Session = Depends(get_db)):
    return ReportService.get_platform_breakdown(db)

@router.get("/party-expenses")
def get_party_expenses(
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    return ReportService.get_party_expense_breakdown(limit, db)

@router.get("/account-summary/{account_id}")
def get_account_summary(
    account_id: int,
    year_month: str = Query(..., description="Format YYYY-MM"),
    db: Session = Depends(get_db)
):
    return ReportService.get_account_monthly_summary(account_id, year_month, db)
