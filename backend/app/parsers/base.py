from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class NormalizedTransaction(BaseModel):
    date: str  # YYYY-MM-DD or raw parsed date
    narration: str
    ref_no: Optional[str] = None
    debit: float = 0.0
    credit: float = 0.0
    balance: float = 0.0
    page_number: int = 1

class ParsingResult(BaseModel):
    bank_name: str = "Generic Bank"
    account_number: Optional[str] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    year_month: Optional[str] = None
    total_credits: float = 0.0
    total_debits: float = 0.0
    transactions: List[NormalizedTransaction] = []
    raw_rows: List[List[str]] = []
    warnings: List[str] = []
