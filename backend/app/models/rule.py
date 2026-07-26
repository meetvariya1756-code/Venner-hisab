from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base

class CategorizationRule(Base):
    __tablename__ = "rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    pattern = Column(String(255), nullable=False)  # Regex or keyword string
    match_type = Column(String(20), default="KEYWORD")  # "KEYWORD", "REGEX", "EXACT"
    field = Column(String(50), default="narration")  # field to match
    party_id = Column(Integer, ForeignKey("parties.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    priority = Column(Integer, default=10)  # Lower number = higher priority
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    party = relationship("Party", back_populates="rules")
    category = relationship("Category", back_populates="rules")
