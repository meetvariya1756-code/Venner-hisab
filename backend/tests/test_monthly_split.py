import sys
import os
try:
    import pytest
except ImportError:
    pytest = None
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import Base
from app.models.account import BankAccount
from app.models.statement import Statement
from app.models.transaction import Transaction
from app.parsers.base import ParsingResult, NormalizedTransaction
from app.services.statement_service import StatementService

# In-memory SQLite DB for clean testing
TEST_DATABASE_URL = "sqlite:///:memory:"

def _fixture_dec(func):
    if pytest:
        return pytest.fixture(func)
    return func

@_fixture_dec
def db_session():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create dummy BankAccount
    acc = BankAccount(
        name="TEST STORE",
        account_holder="Test Owner",
        bank_name="KOTAK",
        account_number="1234567890",
        account_type="Current Account",
        opening_balance=10000.0,
        currency="INR"
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)

    yield db
    db.close()


def test_split_parsing_result_by_month():
    txs = [
        NormalizedTransaction(date="2026-01-15", narration="Tx 1", ref_no="1", debit=500.0, credit=0.0, balance=9500.0, page_number=1),
        NormalizedTransaction(date="2026-01-20", narration="Tx 2", ref_no="2", debit=0.0, credit=2000.0, balance=11500.0, page_number=1),
        NormalizedTransaction(date="2026-02-05", narration="Tx 3", ref_no="3", debit=1000.0, credit=0.0, balance=10500.0, page_number=2),
        NormalizedTransaction(date="2026-02-28", narration="Tx 4", ref_no="4", debit=0.0, credit=5000.0, balance=15500.0, page_number=2),
    ]

    pr = ParsingResult(
        bank_name="KOTAK",
        opening_balance=10000.0,
        closing_balance=15500.0,
        start_date="2026-01-15",
        end_date="2026-02-28",
        year_month="2026-01",
        total_credits=7000.0,
        total_debits=1500.0,
        transactions=txs,
        raw_rows=[]
    )

    chunks = StatementService.split_parsing_result_by_month(pr)
    assert len(chunks) == 2
    assert chunks[0].year_month == "2026-01"
    assert len(chunks[0].transactions) == 2
    assert chunks[0].total_credits == 2000.0
    assert chunks[0].total_debits == 500.0

    assert chunks[1].year_month == "2026-02"
    assert len(chunks[1].transactions) == 2
    assert chunks[1].total_credits == 5000.0
    assert chunks[1].total_debits == 1000.0


def test_duplicate_check_message(db_session):
    acc = db_session.query(BankAccount).first()

    # Pre-insert statement for 2026-01
    stmt = Statement(
        account_id=acc.id,
        filename="january_2026.pdf",
        file_hash="dummy_hash_jan",
        year_month="2026-01",
        start_date="2026-01-01",
        end_date="2026-01-31",
        opening_balance=1000.0,
        closing_balance=2000.0,
        total_credits=1000.0,
        total_debits=0.0,
        transaction_count=1
    )
    db_session.add(stmt)
    db_session.commit()

    is_dup, msg = StatementService.check_duplicate(acc.id, "new_hash", "2026-01", db_session)
    assert is_dup is True
    assert msg == "This month's PDF has already been uploaded."

    is_dup_new, msg_new = StatementService.check_duplicate(acc.id, "new_hash", "2026-02", db_session)
    assert is_dup_new is False
    assert msg_new == ""


def test_multi_month_import_and_partial_skip(db_session):
    acc = db_session.query(BankAccount).first()

    # Pre-insert existing 2026-01 statement
    existing_stmt = Statement(
        account_id=acc.id,
        filename="january.pdf",
        file_hash="hash_jan",
        year_month="2026-01",
        start_date="2026-01-01",
        end_date="2026-01-31",
        opening_balance=1000.0,
        closing_balance=2000.0,
        total_credits=1000.0,
        total_debits=0.0,
        transaction_count=1
    )
    db_session.add(existing_stmt)
    db_session.commit()

    # Multi-month parsing result covering 2026-01 and 2026-02
    txs = [
        NormalizedTransaction(date="2026-01-15", narration="Tx Jan", ref_no="1", debit=100.0, credit=0.0, balance=900.0, page_number=1),
        NormalizedTransaction(date="2026-02-10", narration="Tx Feb", ref_no="2", debit=0.0, credit=500.0, balance=1400.0, page_number=1)
    ]
    pr = ParsingResult(
        bank_name="KOTAK",
        opening_balance=1000.0,
        closing_balance=1400.0,
        start_date="2026-01-15",
        end_date="2026-02-10",
        year_month="2026-01",
        total_credits=500.0,
        total_debits=100.0,
        transactions=txs,
        raw_rows=[]
    )

    breakdown = StatementService.get_monthly_breakdown_status(acc.id, pr, db_session)
    assert breakdown["is_all_duplicate"] is False
    assert breakdown["skipped_months"] == ["2026-01"]
    assert breakdown["new_months"] == ["2026-02"]

    import_res = StatementService.import_parsed_statement(
        account_id=acc.id,
        filename="yearly_2026.pdf",
        file_hash="yearly_hash_123",
        parsing_result=pr,
        db=db_session,
        store_name=acc.name
    )

    assert import_res["imported_count"] == 1
    assert import_res["skipped_count"] == 1
    assert import_res["skipped_months"] == ["2026-01"]
    assert import_res["imported_statements"][0].year_month == "2026-02"

    # Verify database has 2 statements in total (2026-01 and 2026-02)
    all_stmts = db_session.query(Statement).filter(Statement.account_id == acc.id).all()
    assert len(all_stmts) == 2
    yms = sorted([s.year_month for s in all_stmts])
    assert yms == ["2026-01", "2026-02"]


def create_test_db():
    engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    acc = BankAccount(
        name="TEST STORE",
        account_holder="Test Owner",
        bank_name="KOTAK",
        account_number="1234567890",
        account_type="Current Account",
        opening_balance=10000.0,
        currency="INR"
    )
    db.add(acc)
    db.commit()
    db.refresh(acc)
    return db


if __name__ == "__main__":
    print("Running test_split_parsing_result_by_month...")
    test_split_parsing_result_by_month()
    print("PASS: test_split_parsing_result_by_month")

    print("Running test_duplicate_check_message...")
    db1 = create_test_db()
    test_duplicate_check_message(db1)
    db1.close()
    print("PASS: test_duplicate_check_message")

    print("Running test_multi_month_import_and_partial_skip...")
    db2 = create_test_db()
    test_multi_month_import_and_partial_skip(db2)
    db2.close()
    print("PASS: test_multi_month_import_and_partial_skip")

    print("\nALL MONTHLY SPLIT & DEDUPLICATION TESTS PASSED SUCCESSFULLY!")

