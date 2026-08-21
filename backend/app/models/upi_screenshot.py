from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class UPIScreenshot(Base):
    __tablename__ = "upi_screenshots"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="CASCADE"), nullable=False)
    target_account_id = Column(Integer, ForeignKey("bank_accounts.id", ondelete="SET NULL"), nullable=True)
    filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    amount = Column(Float, nullable=True)
    entry_type = Column(String(20), nullable=True)
    description = Column(String(500), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    account = relationship("BankAccount", foreign_keys=[account_id], back_populates="upi_screenshots")
    target_account = relationship("BankAccount", foreign_keys=[target_account_id])
