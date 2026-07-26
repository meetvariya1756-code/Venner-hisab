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
    access_code: Optional[str] = None
    phone_number: Optional[str] = None

class AccountOut(BaseModel):
    id: int
    platform_id: Optional[int] = None
    platform_name: Optional[str] = None
    name: str
    account_holder: Optional[str] = None
    bank_name: str
    account_number: str
    masked_account_number: Optional[str] = None
    account_type: str
    opening_balance: float
    currency: str
    access_code: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Mobile App & Sync Schemas
class MobileAuthRequest(BaseModel):
    access_code: str

class MobileAuthOut(BaseModel):
    store_id: int
    store_name: str
    account_holder: Optional[str] = None
    bank_name: str
    platform_name: str

class AccountChecklistOut(BaseModel):
    account_id: int
    store_name: str
    account_holder: Optional[str] = None
    bank_name: str
    platform_name: str
    access_code: Optional[str] = None
    phone_number: Optional[str] = None
    status: str  # "RECEIVED" or "PENDING"
    uploaded_via_mobile: bool = False
    uploaded_at: Optional[datetime] = None
    statement_id: Optional[int] = None
    filename: Optional[str] = None
    total_in: float = 0.0
    total_out: float = 0.0
    transaction_count: int = 0

# Category Schemas
class CategoryCreate(BaseModel):
    name: str
    type: str  # INCOME or EXPENSE
    parent_id: Optional[int] = None
    color: Optional[str] = "#6366f1"

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
    aliases: Optional[str] = None

class PartyOut(BaseModel):
    id: int
    name: str
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    aliases: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class PartyMergeRequest(BaseModel):
    primary_party_id: int
    secondary_party_ids: List[int]


# Categorization Rule Schemas
class RuleCreate(BaseModel):
    name: str
    pattern: str
    match_type: str = "CONTAINS"  # CONTAINS, EXACT, REGEX, STARTS_WITH
    field: str = "narration"
    party_id: Optional[int] = None
    category_id: Optional[int] = None
    priority: int = 10
    is_active: bool = True

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

class TransactionUpdate(BaseModel):
    party_id: Optional[int] = None
    category_id: Optional[int] = None
    review_status: Optional[str] = None

