from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base

class Platform(Base):
    __tablename__ = "platforms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)  # e.g., "Meesho", "Flipkart", "Amazon"
    code = Column(String(50), nullable=True)  # e.g. MEESHO, FLIPKART, AMAZON
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    accounts = relationship("BankAccount", back_populates="platform", cascade="all, delete-orphan")
