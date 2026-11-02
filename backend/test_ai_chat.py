import sys
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

from app.core.database import SessionLocal
from app.services.ai_assistant_service import AIAssistantService

db = SessionLocal()
service = AIAssistantService(db)

queries = [
    "Mane FABREECART Account ni details janvi chhe",
    "Mane FABREECART account ni details joiye",
    "FABREECART account ni detail aapo",
    "fabreecart account vishe janvu che",
    "Fabreecart acc details",
    "fabreecart ni account information",
    "મને FABREECART Account ની details જાણવી છે",
    "fabreecart account ki details chahiye",
    "FABREECART ma ketla baki chhe?",
    "Badha accounts no total hisab aapo",
    "Details aapo"
]

for q in queries:
    res = service.process_query(q)
    matched = res.get("matched_account", {})
    m_name = matched.get("name") if matched else "None"
    print(f"==================================================")
    print(f"QUERY:   {q}")
    print(f"INTENT:  {res['intent']} | LANG: {res['language']} | MATCHED: {m_name}")
    print(f"REPLY:\n{res['reply']}")
    if res.get("clarification_options"):
        print(f"CLARIFICATION OPTIONS: {[o['name'] for o in res['clarification_options']]}")
    if res.get("quick_actions"):
        print(f"ACTIONS: {[a['label'] for a in res['quick_actions']]}")

db.close()
