from typing import Dict, List, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.transaction import Transaction
from app.models.account import BankAccount
from app.models.statement import Statement
from app.models.category import Category
from app.models.party import Party
from app.models.platform import Platform

class ReportService:
    @staticmethod
    def get_account_monthly_summary(account_id: int, year_month: str, db: Session) -> Dict[str, Any]:
        account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
        if not account:
            raise ValueError("Account not found")

        txs = db.query(Transaction).filter(
            Transaction.account_id == account_id,
            Transaction.date.like(f"{year_month}%")
        ).order_by(Transaction.date.asc()).all()

        total_cr = sum(t.credit for t in txs)
        total_dr = sum(t.debit for t in txs)

        in_entries = []
        out_entries = []

        categories_map = {c.id: c.name for c in db.query(Category).all()}
        parties_map = {p.id: p.name for p in db.query(Party).all()}

        for t in txs:
            item = {
                "id": t.id,
                "date": t.date,
                "narration": t.narration,
                "ref_no": t.ref_no,
                "amount": t.credit if t.credit > 0 else t.debit,
                "balance": t.balance,
                "category": categories_map.get(t.category_id, "Uncategorized"),
                "party": parties_map.get(t.party_id, None),
                "page_number": t.page_number
            }
            if t.credit > 0:
                in_entries.append(item)
            if t.debit > 0:
                out_entries.append(item)

        return {
            "account_id": account.id,
            "account_name": account.name,
            "account_holder": account.account_holder,
            "bank_name": account.bank_name,
            "account_number": account.account_number,
            "platform_name": account.platform.name if account.platform else "General",
            "year_month": year_month,
            "total_transactions": len(txs),
            "total_in": round(total_cr, 2),
            "total_out": round(total_dr, 2),
            "net": round(total_cr - total_dr, 2),
            "in_entries_count": len(in_entries),
            "out_entries_count": len(out_entries),
            "in_entries": in_entries,
            "out_entries": out_entries,
        }

    @staticmethod
    def get_consolidated_dashboard(year_month: Optional[str], db: Session) -> Dict[str, Any]:
        tx_query = db.query(Transaction)
        if year_month:
            tx_query = tx_query.filter(Transaction.date.like(f"{year_month}%"))

        all_txs = tx_query.all()
        total_income = sum(t.credit for t in all_txs)
        total_expense = sum(t.debit for t in all_txs)
        net_result = total_income - total_expense

        accounts_count = db.query(BankAccount).count()
        platforms_count = db.query(Platform).count()
        statements_count = db.query(Statement).count()
        uncategorized_count = db.query(Transaction).filter(Transaction.is_categorized == False).count()

        monthly_trend = []
        monthly_groups = {}
        for t in all_txs:
            ym = t.date[:7] if t.date and len(t.date) >= 7 else "Unknown"
            if ym not in monthly_groups:
                monthly_groups[ym] = {"income": 0.0, "expense": 0.0}
            monthly_groups[ym]["income"] += t.credit
            monthly_groups[ym]["expense"] += t.debit

        for ym in sorted(monthly_groups.keys()):
            monthly_trend.append({
                "month": ym,
                "income": round(monthly_groups[ym]["income"], 2),
                "expense": round(monthly_groups[ym]["expense"], 2),
                "net": round(monthly_groups[ym]["income"] - monthly_groups[ym]["expense"], 2)
            })

        return {
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "net_result": round(net_result, 2),
            "accounts_count": accounts_count,
            "platforms_count": platforms_count,
            "statements_count": statements_count,
            "uncategorized_count": uncategorized_count,
            "monthly_trend": monthly_trend
        }

    @staticmethod
    def get_platform_breakdown(db: Session) -> Dict[str, Any]:
        platforms = db.query(Platform).all()
        result = []

        for p in platforms:
            accounts = [a.id for a in p.accounts]
            txs = db.query(Transaction).filter(Transaction.account_id.in_(accounts)).all() if accounts else []
            total_in = sum(t.credit for t in txs)
            total_out = sum(t.debit for t in txs)

            result.append({
                "platform_id": p.id,
                "platform_name": p.name,
                "account_count": len(p.accounts),
                "total_in": round(total_in, 2),
                "total_out": round(total_out, 2),
                "net": round(total_in - total_out, 2)
            })

        return {"platforms": result}
