from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    platform_id = Column(Integer, ForeignKey("platforms.id", ondelete="CASCADE"), nullable=True)
    name = Column(String(100), nullable=False)  # Seller store / account name (e.g., "DAPPERDOM", "VIMS")
    account_holder = Column(String(150), nullable=True)  # e.g., "Prajapati Kiritbhai"
    bank_name = Column(String(100), nullable=False)  # e.g., "Kotak Mahindra Bank", "SBI"
    account_number = Column(String(100), nullable=False)  # full account number
    account_type = Column(String(50), default="Savings")  # Savings, Current, Overdraft
    opening_balance = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")
    access_code = Column(String(50), unique=True, nullable=True, index=True)  # Mobile app upload PIN code e.g. "DAPPERDOM-7849"
    phone_number = Column(String(30), nullable=True)  # Account holder phone for WhatsApp reminders
    pdf_password = Column(String(100), nullable=True)  # Statement PDF password (if protected) — stored as hint for mobile
    created_at = Column(DateTime, default=datetime.utcnow)

    platform = relationship("Platform", back_populates="accounts")
    statements = relationship("Statement", back_populates="account", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")

    @property
    def masked_account_number(self) -> str:
        if not self.account_number:
            return ""
        if len(self.account_number) <= 4:
            return self.account_number
        return "*" * (len(self.account_number) - 4) + self.account_number[-4:]
