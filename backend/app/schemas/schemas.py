from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

# Platform Schemas
class PlatformCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None

class PlatformOut(BaseModel):
    id: int
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    account_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# Bank Account Schemas
class AccountCreate(BaseModel):
    platform_id: int
    name: str  # Store Name / Account Name e.g., "DAPPERDOM", "VIMS"
    account_holder: Optional[str] = None  # e.g., "Prajapati Kiritbhai"
    bank_name: str
    account_number: str
    account_type: str = "Savings"
    opening_balance: float = 0.0
    currency: str = "INR"

class AccountOut(BaseModel):
    id: int
    platform_id: Optional[int] = None
    platform_name: Optional[str] = None
    name: str
    account_holder: Optional[str] = None
    bank_name: str
    account_number: str
    masked_account_number: str
    account_type: str
    opening_balance: float
    currency: str
    created_at: datetime

    class Config:
        from_attributes = True

# Category Schemas
class CategoryCreate(BaseModel):
    name: str
    type: str  # "INCOME" or "EXPENSE"
    parent_id: Optional[int] = None
    color: str = "#6366f1"

class CategoryOut(BaseModel):
    id: int
    name: str
    type: str
    parent_id: Optional[int] = None
    is_system: bool
    color: str

    class Config:
        from_attributes = True

# Party Schemas
class PartyCreate(BaseModel):
    name: str
    category_id: Optional[int] = None
    aliases: Optional[List[str]] = []

class PartyOut(BaseModel):
    id: int
    name: str
    category_id: Optional[int] = None
    aliases: str
    created_at: datetime

    class Config:
        from_attributes = True

class PartyMergeRequest(BaseModel):
    source_party_ids: List[int]
    target_party_id: int

# Rule Schemas
class RuleCreate(BaseModel):
    name: str
    pattern: str
    match_type: str = "KEYWORD"
    field: str = "narration"
    party_id: Optional[int] = None
    category_id: Optional[int] = None
    priority: int = 10

class RuleOut(BaseModel):
    id: int
    name: str
    pattern: str
    match_type: str
    field: str
    party_id: Optional[int] = None
    category_id: Optional[int] = None
    priority: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    party_id: Optional[int] = None
    create_rule: bool = False
    rule_name: Optional[str] = None
    pattern: Optional[str] = None

class TransactionOut(BaseModel):
    id: int
    statement_id: int
    account_id: int
    date: str
    narration: str
    ref_no: Optional[str] = None
    debit: float
    credit: float
    balance: float
    page_number: int
    party_id: Optional[int] = None
    category_id: Optional[int] = None
    is_categorized: bool
    review_status: str
    party_name: Optional[str] = None
    category_name: Optional[str] = None

    class Config:
        from_attributes = True
