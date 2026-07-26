from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Statement(Base):
    __tablename__ = "statements"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_hash = Column(String(64), nullable=False, index=True)  # SHA256 file hash
    year_month = Column(String(7), nullable=False)  # e.g., "2026-02"
    start_date = Column(String(20), nullable=True)
    end_date = Column(String(20), nullable=True)
    opening_balance = Column(Float, default=0.0)
    closing_balance = Column(Float, default=0.0)
    total_credits = Column(Float, default=0.0)
    total_debits = Column(Float, default=0.0)
    transaction_count = Column(Integer, default=0)
    status = Column(String(20), default="imported")  # "pending_review", "imported"
    uploaded_via_mobile = Column(Boolean, default=False)
    original_file_path = Column(String(500), nullable=True)  # Local storage path for download
    uploader_name = Column(String(150), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("BankAccount", back_populates="statements")
    transactions = relationship("Transaction", back_populates="statement", cascade="all, delete-orphan")
