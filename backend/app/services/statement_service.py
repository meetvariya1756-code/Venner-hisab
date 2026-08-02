import os
import hashlib
import json
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.models.audit import AuditLog
from app.parsers.base import ParsingResult, NormalizedTransaction
from app.services.categorization_service import CategorizationService

try:
    import pypdf
except ImportError:
    pypdf = None

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "statements")
os.makedirs(UPLOAD_DIR, exist_ok=True)


class MonthlyChunk:
    def __init__(
        self,
        year_month: str,
        transactions: List[NormalizedTransaction],
        start_date: str,
        end_date: str,
        total_credits: float,
        total_debits: float,
        opening_balance: float,
        closing_balance: float,
        page_numbers: List[int]
    ):
        self.year_month = year_month
        self.transactions = transactions
        self.start_date = start_date
        self.end_date = end_date
        self.total_credits = total_credits
        self.total_debits = total_debits
        self.opening_balance = opening_balance
        self.closing_balance = closing_balance
        self.page_numbers = page_numbers


class StatementService:
    @staticmethod
    def calculate_file_hash(file_bytes: bytes) -> str:
        return hashlib.sha256(file_bytes).hexdigest()

    @staticmethod
    def split_parsing_result_by_month(parsing_result: ParsingResult) -> List[MonthlyChunk]:
        """
        Group transactions by YYYY-MM and construct monthly chunks.
        """
        if not parsing_result.transactions:
            ym = parsing_result.year_month or "Unknown"
            return [
                MonthlyChunk(
                    year_month=ym,
                    transactions=[],
                    start_date=parsing_result.start_date or "",
                    end_date=parsing_result.end_date or "",
                    total_credits=parsing_result.total_credits or 0.0,
                    total_debits=parsing_result.total_debits or 0.0,
                    opening_balance=parsing_result.opening_balance or 0.0,
                    closing_balance=parsing_result.closing_balance or 0.0,
                    page_numbers=[1]
                )
            ]

        grouped: Dict[str, List[NormalizedTransaction]] = {}
        for tx in parsing_result.transactions:
            ym = tx.date[:7] if tx.date and len(tx.date) >= 7 else "Unknown"
            if ym not in grouped:
                grouped[ym] = []
            grouped[ym].append(tx)

        chunks: List[MonthlyChunk] = []
        for ym in sorted(grouped.keys()):
            txs = sorted(grouped[ym], key=lambda x: x.date)
            start_date = txs[0].date
            end_date = txs[-1].date
            total_credits = sum(t.credit for t in txs)
            total_debits = sum(t.debit for t in txs)
            opening_bal = txs[0].balance - txs[0].credit + txs[0].debit
            closing_bal = txs[-1].balance
            page_nums = sorted(list(set(t.page_number for t in txs if t.page_number)))
            if not page_nums:
                page_nums = [1]

            chunks.append(
                MonthlyChunk(
                    year_month=ym,
                    transactions=txs,
                    start_date=start_date,
                    end_date=end_date,
                    total_credits=total_credits,
                    total_debits=total_debits,
                    opening_balance=opening_bal,
                    closing_balance=closing_bal,
                    page_numbers=page_nums
                )
            )

        return chunks

    @staticmethod
    def check_duplicate(account_id: int, file_hash: str, year_month: str, db: Session) -> Tuple[bool, str]:
        # Hash check
        existing_by_hash = db.query(Statement).filter(
            Statement.account_id == account_id,
            Statement.file_hash == file_hash
        ).first()
        if existing_by_hash:
            return True, "This month's PDF has already been uploaded."

        # Month & Account overlap check
        existing_by_month = db.query(Statement).filter(
            Statement.account_id == account_id,
            Statement.year_month == year_month
        ).first()
        if existing_by_month:
            return True, "This month's PDF has already been uploaded."

        return False, ""

    @staticmethod
    def get_monthly_breakdown_status(
        account_id: int,
        parsing_result: ParsingResult,
        db: Session
    ) -> Dict[str, Any]:
        """
        Analyze multi-month PDF transactions and determine which months are new vs already uploaded.
        """
        chunks = StatementService.split_parsing_result_by_month(parsing_result)
        months_info = []
        new_months = []
        skipped_months = []

        for chunk in chunks:
            existing = db.query(Statement).filter(
                Statement.account_id == account_id,
                Statement.year_month == chunk.year_month
            ).first()

            status = "already_uploaded" if existing else "new"
            if existing:
                skipped_months.append(chunk.year_month)
            else:
                new_months.append(chunk.year_month)

            months_info.append({
                "year_month": chunk.year_month,
                "start_date": chunk.start_date,
                "end_date": chunk.end_date,
                "transaction_count": len(chunk.transactions),
                "total_credits": chunk.total_credits,
                "total_debits": chunk.total_debits,
                "status": status,
                "existing_filename": existing.filename if existing else None
            })

        is_all_duplicate = len(new_months) == 0

        return {
            "months_info": months_info,
            "new_months": new_months,
            "skipped_months": skipped_months,
            "is_all_duplicate": is_all_duplicate,
            "duplicate_message": "This month's PDF has already been uploaded." if is_all_duplicate else None
        }

    @staticmethod
    def extract_monthly_pdf(original_pdf_bytes: bytes, page_numbers: List[int]) -> bytes:
        """
        Extract specific pages from original PDF bytes to generate a monthly sub-PDF file.
        """
        if not pypdf or not original_pdf_bytes:
            return original_pdf_bytes or b""

        try:
            import io
            reader = pypdf.PdfReader(io.BytesIO(original_pdf_bytes))
            writer = pypdf.PdfWriter()

            total_pages = len(reader.pages)
            pages_added = 0

            for p_num in page_numbers:
                page_idx = p_num - 1
                if 0 <= page_idx < total_pages:
                    writer.add_page(reader.pages[page_idx])
                    pages_added += 1

            if pages_added == 0:
                return original_pdf_bytes

            out_stream = io.BytesIO()
            writer.write(out_stream)
            return out_stream.getvalue()
        except Exception as e:
            print(f"Sub-PDF extraction failed, fallback to original: {e}")
            return original_pdf_bytes

    @staticmethod
    def import_parsed_statement(
        account_id: int,
        filename: str,
        file_hash: str,
        parsing_result: ParsingResult,
        db: Session,
        uploader_name: Optional[str] = None,
        uploaded_via_mobile: bool = False,
        original_file_bytes: Optional[bytes] = None,
        store_name: str = "store"
    ) -> Dict[str, Any]:
        """
        Imports parsing result. Automatically splits multi-month PDFs into individual monthly Statement records,
        skipping any months that have already been uploaded for this account.
        """
        chunks = StatementService.split_parsing_result_by_month(parsing_result)
        imported_statements: List[Statement] = []
        skipped_months: List[str] = []

        store_slug = store_name.replace(" ", "_").lower()

        for chunk in chunks:
            # Check if this month is already uploaded
            existing = db.query(Statement).filter(
                Statement.account_id == account_id,
                Statement.year_month == chunk.year_month
            ).first()

            if existing:
                skipped_months.append(chunk.year_month)
                continue

            # Generate monthly sub-PDF if file bytes provided
            if original_file_bytes:
                monthly_pdf_bytes = StatementService.extract_monthly_pdf(original_file_bytes, chunk.page_numbers)
                chunk_hash = hashlib.sha256(monthly_pdf_bytes).hexdigest()
            else:
                monthly_pdf_bytes = b""
                chunk_hash = hashlib.sha256(f"{file_hash}_{chunk.year_month}".encode()).hexdigest()

            # Save monthly PDF to disk
            save_filename = f"{store_slug}_{chunk.year_month}_{chunk_hash[:8]}.pdf"
            save_path = os.path.join(UPLOAD_DIR, save_filename)

            if monthly_pdf_bytes:
                with open(save_path, "wb") as f:
                    f.write(monthly_pdf_bytes)

            stmt = Statement(
                account_id=account_id,
                filename=f"{filename} ({chunk.year_month})" if len(chunks) > 1 else filename,
                file_hash=chunk_hash,
                year_month=chunk.year_month,
                start_date=chunk.start_date,
                end_date=chunk.end_date,
                opening_balance=chunk.opening_balance,
                closing_balance=chunk.closing_balance,
                total_credits=chunk.total_credits,
                total_debits=chunk.total_debits,
                transaction_count=len(chunk.transactions),
                status="imported",
                original_file_path=save_path if monthly_pdf_bytes else None,
                uploader_name=uploader_name,
                uploaded_via_mobile=uploaded_via_mobile
            )
            db.add(stmt)
            db.flush()  # get stmt.id

            for tx in chunk.transactions:
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
            imported_statements.append(stmt)

        return {
            "imported_statements": imported_statements,
            "skipped_months": skipped_months,
            "imported_count": len(imported_statements),
            "skipped_count": len(skipped_months)
        }

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
