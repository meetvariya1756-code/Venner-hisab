from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class KhatabookEntry(Base):
    __tablename__ = "khatabook_entries"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    entry_type = Column(String(10), nullable=False)  # "GAVE" or "GOT"
    amount = Column(Float, nullable=False)
    description = Column(Text, nullable=True)  # e.g., "BARFI-PC-2 8 BARFI-PC-3 30"
    entry_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    bill_image_path = Column(String(500), nullable=True)
    created_by_user_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("BankAccount", backref="khatabook_entries")
