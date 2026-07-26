import hashlib
import json
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.audit import AuditLog
from app.parsers.base import ParsingResult
from app.services.categorization_service import CategorizationService

class StatementService:
    @staticmethod
    def calculate_file_hash(file_bytes: bytes) -> str:
        return hashlib.sha256(file_bytes).hexdigest()

    @staticmethod
    def check_duplicate(account_id: int, file_hash: str, year_month: str, db: Session) -> Tuple[bool, str]:
        # Hash check
        existing_by_hash = db.query(Statement).filter(Statement.file_hash == file_hash).first()
        if existing_by_hash:
            return True, f"Duplicate statement file detected (uploaded as '{existing_by_hash.filename}' on {existing_by_hash.uploaded_at.strftime('%Y-%m-%d')})."

        # Month & Account overlap check
        existing_by_month = db.query(Statement).filter(
            Statement.account_id == account_id,
            Statement.year_month == year_month
        ).first()
        if existing_by_month:
            return True, f"A statement for account #{account_id} for period {year_month} has already been imported ('{existing_by_month.filename}')."

        return False, ""

    @staticmethod
    def import_parsed_statement(
        account_id: int,
        filename: str,
        file_hash: str,
        parsing_result: ParsingResult,
        db: Session
    ) -> Statement:
        stmt = Statement(
            account_id=account_id,
            filename=filename,
            file_hash=file_hash,
            year_month=parsing_result.year_month or "Unknown",
            start_date=parsing_result.start_date,
            end_date=parsing_result.end_date,
            opening_balance=parsing_result.opening_balance or 0.0,
            closing_balance=parsing_result.closing_balance or 0.0,
            total_credits=parsing_result.total_credits,
            total_debits=parsing_result.total_debits,
            transaction_count=len(parsing_result.transactions),
            status="imported"
        )
        db.add(stmt)
        db.flush()  # get stmt.id

        for tx in parsing_result.transactions:
            party_id, cat_id, review_status = CategorizationService.auto_categorize(tx.narration, db)
            
            db_tx = Transaction(
                statement_id=stmt.id,
                account_id=account_id,
                date=tx.date,
                narration=tx.narration,
                ref_no=tx.ref_no,
                debit=tx.debit,
                credit=tx.credit,
                balance=tx.balance,
                page_number=tx.page_number,
                party_id=party_id,
                category_id=cat_id,
                is_categorized=(cat_id is not None),
                review_status=review_status
            )
            db.add(db_tx)

        db.commit()
        db.refresh(stmt)
        return stmt

    @staticmethod
    def update_transaction_category(
        transaction_id: int,
        category_id: Optional[int],
        party_id: Optional[int],
        user_info: str,
        db: Session
    ) -> Transaction:
        tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
        if not tx:
            raise ValueError("Transaction not found")

        old_vals = {"category_id": tx.category_id, "party_id": tx.party_id, "review_status": tx.review_status}
        
        tx.category_id = category_id
        if party_id is not None:
            tx.party_id = party_id
        tx.is_categorized = (category_id is not None)
        tx.review_status = "manually_reviewed"

        new_vals = {"category_id": category_id, "party_id": tx.party_id, "review_status": "manually_reviewed"}

        # Audit log entry
        audit = AuditLog(
            transaction_id=tx.id,
            action="UPDATE_CATEGORY",
            old_values=json.dumps(old_vals),
            new_values=json.dumps(new_vals),
            user_info=user_info
        )
        db.add(audit)

        db.commit()
        db.refresh(tx)
        return tx
