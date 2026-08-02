from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False) # Login ID
    password = Column(String(255), nullable=False)
    role = Column(String(20), default="owner", nullable=False) # "owner" or "manager"
    full_name = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
