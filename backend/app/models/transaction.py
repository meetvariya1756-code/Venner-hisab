from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    statement_id = Column(Integer, ForeignKey("statements.id", ondelete="CASCADE"), nullable=False)
    account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(20), nullable=False)  # ISO Date YYYY-MM-DD
    narration = Column(String(500), nullable=False)
    ref_no = Column(String(100), nullable=True)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    balance = Column(Float, default=0.0)
    page_number = Column(Integer, default=1)
    
    party_id = Column(Integer, ForeignKey("parties.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    
    is_categorized = Column(Boolean, default=False)
    review_status = Column(String(20), default="uncategorized")  # uncategorized, auto_matched, manually_reviewed
    created_at = Column(DateTime, default=datetime.utcnow)

    statement = relationship("Statement", back_populates="transactions")
    account = relationship("BankAccount", back_populates="transactions")
    party = relationship("Party", back_populates="transactions")
    category = relationship("Category", back_populates="transactions")
    audit_logs = relationship("AuditLog", back_populates="transaction", cascade="all, delete-orphan")
