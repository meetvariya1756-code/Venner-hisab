import sys
import os
import pytest

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.parsers.detector import detect_column_indices, clean_amount, parse_date_string
from app.parsers.generic_parser import StatementParserEngine
from app.services.categorization_service import CategorizationService
from app.core.database import SessionLocal, Base, engine
from app.core.default_data import seed_default_data

def test_amount_cleaner():
    assert clean_amount("29,244.75") == 29244.75
    assert clean_amount("₹ 1,59,505.47") == 159505.47
    assert clean_amount("-") == 0.0
    assert clean_amount("") == 0.0

def test_date_parser():
    assert parse_date_string("02 Feb 2026") == "2026-02-02"
    assert parse_date_string("18/02/2026") == "2026-02-18"

def test_column_detector():
    headers = ["#", "Date", "Description", "Chq/Ref. No.", "Withdrawal (Dr.)", "Deposit (Cr.)", "Balance"]
    col_map = detect_column_indices(headers)
    assert col_map["date"] == 1
    assert col_map["description"] == 2
    assert col_map["ref_no"] == 3
    assert col_map["debit"] == 4
    assert col_map["credit"] == 5
    assert col_map["balance"] == 6

def test_meesho_categorization():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_default_data(db)

    party_id, cat_id, status = CategorizationService.auto_categorize(
        "NEFT AXISCN1237890859 MEESHO TECHNOLOGIES PRIVATE", db
    )
    assert party_id == 1  # Meesho party
    assert cat_id == 1    # Meesho category
    assert status == "auto_matched"
    db.close()
