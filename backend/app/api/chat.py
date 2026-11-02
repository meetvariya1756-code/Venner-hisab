from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.core.database import get_db
from app.services.ai_assistant_service import AIAssistantService
from app.models.account import BankAccount

router = APIRouter(prefix="/chat", tags=["AI Assistant Chat"])

class ChatMessageRequest(BaseModel):
    message: str
    context_account_id: Optional[int] = None

@router.post("/message")
def send_chat_message(
    payload: ChatMessageRequest,
    db: Session = Depends(get_db)
):
    """
    Process natural language queries in English, Gujarati, Gujlish, Hinglish, or WhatsApp-style dialect.
    """
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    service = AIAssistantService(db)
    result = service.process_query(payload.message)
    return result

@router.get("/suggestions")
def get_chat_suggestions(db: Session = Depends(get_db)):
    """
    Return dynamic starter prompts based on actual database accounts in Gujlish and English.
    """
    accounts = db.query(BankAccount).order_by(BankAccount.name.asc()).limit(4).all()
    
    first_acc_name = accounts[0].name if accounts else "FABREECART"
    second_acc_name = accounts[1].name if len(accounts) > 1 else "MEESHO"

    return {
        "suggestions": [
            f"Mane {first_acc_name} Account ni details janvi chhe",
            f"{first_acc_name} ma ketla baki chhe?",
            f"{second_acc_name} nu PDF ledger statement moklo",
            "Badha accounts no total hisab aapo",
            f"{first_acc_name} ni chhella 5 entries jovi chhe"
        ]
    }
