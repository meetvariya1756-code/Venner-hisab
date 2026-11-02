import re
import difflib
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.account import BankAccount
from app.models.khatabook_entry import KhatabookEntry
from app.models.transaction import Transaction

class AIAssistantService:
    def __init__(self, db: Session):
        self.db = db

    def _normalize_text(self, text: str) -> str:
        text = text.lower().strip()
        # Remove extra punctuation but keep alphanumerics and spaces
        text = re.sub(r'[\'"`.,!?;:()\[\]{}]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text

    def _detect_language(self, text: str) -> str:
        # Check for Gujarati Unicode range 0A80-0AFF
        if any('\u0a80' <= char <= '\u0aff' for char in text):
            return "gujarati"
        
        normalized = text.lower()
        gujlish_markers = ["mane", "tamne", "janvi", "janvu", "joiye", "aapo", "chhe", "che", "nathi", "vishe", "ketla", "ketlu", "baki", "hisab", "moklo", "aapiya", "lidha", "aave", "badha"]
        hinglish_markers = ["mujhe", "chahiye", "batao", "dikhao", "kitna", "bhejo", "karo", "hai", "karna", "paisa", "paise"]
        
        if any(w in normalized for w in gujlish_markers):
            return "gujlish"
        if any(w in normalized for w in hinglish_markers):
            return "hinglish"
        return "english"

    def _find_best_matching_account(self, query: str, accounts: List[BankAccount]) -> Optional[BankAccount]:
        if not accounts:
            return None

        clean_query = self._normalize_text(query)
        words = clean_query.split()

        # Common stop words in Gujlish/Hinglish/English
        stop_words = {
            "mane", "hu", "tame", "tamne", "ni", "nu", "na", "no", "ne", "ma", "mathi", "thi",
            "janvi", "janvu", "joiye", "aapo", "chhe", "che", "vishe", "details", "detail",
            "account", "acc", "ac", "information", "info", "batao", "dikhao", "chahiye",
            "please", "can", "you", "give", "me", "show", "tell", "about", "the", "a", "an",
            "ketla", "ketlu", "kitna", "balance", "baki", "hisab", "ledger", "pdf", "entries",
            "transaction", "transactions", "ka", "ki", "ke", "ko", "karo", "moklo", "mujhe",
            "hai", "hoga", "shun", "su"
        }

        # 1. Exact match on whole account name or holder name
        for acc in accounts:
            acc_name_clean = self._normalize_text(acc.name)
            holder_clean = self._normalize_text(acc.account_holder or "")
            
            # If full account name is contained in the query
            if acc_name_clean and acc_name_clean in clean_query:
                return acc
            if holder_clean and len(holder_clean) > 3 and holder_clean in clean_query:
                return acc

        # 2. Token / Substring matching on non-stop words
        filtered_query_words = [w for w in words if w not in stop_words and len(w) >= 2]
        
        best_acc = None
        best_score = 0.0

        for acc in accounts:
            acc_name_clean = self._normalize_text(acc.name)
            acc_words = acc_name_clean.split()
            
            # Check for direct word matching or partial matches
            for qw in filtered_query_words:
                for aw in acc_words:
                    if qw == aw:
                        return acc
                    # Substring check
                    if len(qw) >= 4 and (qw in aw or aw in qw):
                        return acc
                    # Fuzzy similarity
                    ratio = difflib.SequenceMatcher(None, qw, aw).ratio()
                    if ratio > best_score and ratio >= 0.70:
                        best_score = ratio
                        best_acc = acc

        if best_score >= 0.70 and best_acc:
            return best_acc

        return None

    def _get_account_financials(self, account_id: int) -> Dict[str, Any]:
        entries = self.db.query(KhatabookEntry).filter(
            KhatabookEntry.account_id == account_id
        ).order_by(KhatabookEntry.entry_date.desc(), KhatabookEntry.id.desc()).all()

        total_gave = sum(e.amount for e in entries if e.entry_type == "GAVE")
        total_got = sum(e.amount for e in entries if e.entry_type == "GOT")
        net_balance = total_got - total_gave
        
        recent_entries = []
        for e in entries[:5]:
            recent_entries.append({
                "id": e.id,
                "type": e.entry_type,
                "amount": float(e.amount),
                "description": e.description or "",
                "date": e.entry_date.strftime("%d %b %Y") if e.entry_date else ""
            })

        return {
            "total_gave": total_gave,
            "total_got": total_got,
            "net_balance": net_balance,
            "status": "YOU_WILL_GET" if net_balance > 0 else ("YOU_WILL_GIVE" if net_balance < 0 else "SETTLED"),
            "entries_count": len(entries),
            "recent_entries": recent_entries
        }

    def process_query(self, user_query: str) -> Dict[str, Any]:
        query = user_query.strip()
        lang = self._detect_language(query)
        norm_q = self._normalize_text(query)

        # Get all bank accounts
        all_accounts = self.db.query(BankAccount).order_by(BankAccount.name.asc()).all()

        # ── 1. Intent Detection ──────────────────────────────────────────
        is_all_accounts_query = any(k in norm_q for k in [
            "badha account", "badha acc", "badha no hisab", "badha accounts", 
            "all accounts", "all account", "total baki", "kul hisab", "total balance",
            "sab account", "sabka hisab", "badha nu ledger"
        ])

        matched_account = self._find_best_matching_account(query, all_accounts)

        # Classify sub-intent
        intent = "ACCOUNT_DETAILS"
        if any(w in norm_q for w in ["balance", "ketla baki", "ketlu baki", "kitna baki", "kitna lena", "kitna dena", "rupya baki", "kitne paise", "baki kitna", "shun baki", "બાકી"]):
            intent = "BALANCE_CHECK"
        elif any(w in norm_q for w in ["pdf", "statement", "ledger", "download", "report", "export", "file", "પીડીએફ", "સ્ટેટમેન્ટ"]):
            intent = "DOWNLOAD_PDF"
        elif any(w in norm_q for w in ["whatsapp", "reminder", "slip", "moklo", "send msg", "remind", "મોકલો"]):
            intent = "WHATSAPP_REMINDER"
        elif any(w in norm_q for w in ["entry", "entries", "transactions", "history", "chhella", "last 5", "last entry", "history", "ટ્રાન્ઝેક્શન"]):
            intent = "RECENT_ENTRIES"
        elif any(w in norm_q for w in ["upi", "qr", "qr code", "scanner", "pay qr"]):
            intent = "UPI_QR"

        # ── 2. Handle All Accounts Summary ──────────────────────────────
        if is_all_accounts_query or (not matched_account and any(w in norm_q for w in ["total", "kul", "badha", "overall", "summary"])):
            all_entries = self.db.query(KhatabookEntry).all()
            total_gave = sum(e.amount for e in all_entries if e.entry_type == "GAVE")
            total_got = sum(e.amount for e in all_entries if e.entry_type == "GOT")
            net_total = total_got - total_gave

            if lang in ["gujlish", "gujarati"]:
                reply = f"📊 **કુલ ખાતાવહી સારાંશ ({len(all_accounts)} એકાઉન્ટ્સ)**:\n\n" \
                        f"• **તમારે લેવાના બાકી (You will Get)**: ₹{total_got:,.2f}\n" \
                        f"• **તમારે આપવાના બાકી (You will Give)**: ₹{total_gave:,.2f}\n" \
                        f"• **નેટ બેલેન્સ**: ₹{abs(net_total):,.2f} ({'લેવાના' if net_total >= 0 else 'આપવાના'})\n\n" \
                        f"તમે નીચે આપેલા એકાઉન્ટમાંથી કોઈ ચોક્કસ ખાતાની વિગત પણ જોઈ શકો છો:"
            else:
                reply = f"📊 **Overall Khatabook Summary ({len(all_accounts)} Accounts)**:\n\n" \
                        f"• **Total Receivable (You will Get)**: ₹{total_got:,.2f}\n" \
                        f"• **Total Payable (You will Give)**: ₹{total_gave:,.2f}\n" \
                        f"• **Net Balance**: ₹{abs(net_total):,.2f} ({'To Receive' if net_total >= 0 else 'To Pay'})\n\n" \
                        f"Which specific account would you like to explore?"

            account_options = [{"id": acc.id, "name": acc.name, "holder": acc.account_holder} for acc in all_accounts[:8]]
            
            return {
                "reply": reply,
                "intent": "ALL_ACCOUNTS_SUMMARY",
                "language": lang,
                "matched_account": None,
                "clarification_options": account_options,
                "quick_actions": [
                    {"label": "📄 Download All PDF", "action": "download_all_pdf"},
                    {"label": "🔄 Refresh Accounts", "action": "refresh_accounts"}
                ]
            }

        # ── 3. Handle Clarification if No Account is Matched ───────────
        if not matched_account:
            account_options = [{"id": acc.id, "name": acc.name, "holder": acc.account_holder} for acc in all_accounts[:8]]
            
            if lang in ["gujlish", "gujarati"]:
                reply = "મને સમજાયું કે તમે ખાતાની વિગતો જાણવા માંગો છો. પરંતુ કયા **Account** ની વિગતો જોવી છે? કૃપા કરીને નીચેનામાંથી પસંદ કરો અથવા એકાઉન્ટનું નામ લખો:"
            elif lang == "hinglish":
                reply = "Aap kis **Account** ki details dekhna chahte hain? Kripya niche diye gaye account me se select karein ya account ka naam likhein:"
            else:
                reply = "I understand you are looking for account details. Which **Account** would you like to view? Please select from the list below or type the name:"

            return {
                "reply": reply,
                "intent": "CLARIFICATION_REQUIRED",
                "language": lang,
                "matched_account": None,
                "clarification_options": account_options,
                "quick_actions": []
            }

        # ── 4. Matched Specific Account ────────────────────────────────
        fin = self._get_account_financials(matched_account.id)
        balance_abs = abs(fin["net_balance"])
        
        if fin["status"] == "YOU_WILL_GET":
            status_text_en = f"You will Get ₹{balance_abs:,.2f}"
            status_text_gu = f"તમારે ₹{balance_abs:,.2f} લેવાના બાકી છે"
        elif fin["status"] == "YOU_WILL_GIVE":
            status_text_en = f"You will Give ₹{balance_abs:,.2f}"
            status_text_gu = f"તમારે ₹{balance_abs:,.2f} આપવાના બાકી છે"
        else:
            status_text_en = "Account is Settled (₹0.00)"
            status_text_gu = "ખાતું પૂરું ચૂકવાઈ ગયેલ છે (₹0.00)"

        account_data = {
            "id": matched_account.id,
            "name": matched_account.name,
            "account_holder": matched_account.account_holder or "N/A",
            "bank_name": matched_account.bank_name,
            "account_number": matched_account.masked_account_number,
            "phone_number": matched_account.phone_number or "",
            "upi_id": matched_account.upi_id or "",
            "credit_limit": float(matched_account.credit_limit or 0),
            "due_date": matched_account.due_date.strftime("%d %b %Y") if matched_account.due_date else None,
            "financials": fin
        }

        quick_actions = [
            {"label": "💳 Check Balance", "action": "show_balance", "accountId": matched_account.id, "accountName": matched_account.name},
            {"label": "📄 Download PDF", "action": "download_pdf", "accountId": matched_account.id, "accountName": matched_account.name},
            {"label": "📝 Recent Entries", "action": "show_entries", "accountId": matched_account.id, "accountName": matched_account.name},
            {"label": "💬 WhatsApp Slip", "action": "whatsapp_reminder", "accountId": matched_account.id, "accountName": matched_account.name},
            {"label": "👁️ Open in Khatabook", "action": "open_khatabook", "accountId": matched_account.id, "accountName": matched_account.name}
        ]

        if matched_account.upi_id:
            quick_actions.insert(2, {"label": "📲 Pay UPI QR", "action": "show_upi_qr", "accountId": matched_account.id, "accountName": matched_account.name, "upiId": matched_account.upi_id})

        # Generate response matching intent
        if intent == "BALANCE_CHECK":
            if lang in ["gujlish", "gujarati"]:
                reply = f"💰 **{matched_account.name}** નો વર્તમાન બેલેન્સ:\n\n" \
                        f"👉 **{status_text_gu}**\n" \
                        f"• કુલ જમા (Got): ₹{fin['total_got']:,.2f}\n" \
                        f"• કુલ ઉધાર (Gave): ₹{fin['total_gave']:,.2f}\n\n" \
                        f"તમે નીચે આપેલા બટનથી PDF સ્ટેટમેન્ટ અથવા WhatsApp રીમાઇન્ડર પણ મોકલી શકો છો."
            else:
                reply = f"💰 **{matched_account.name}** Current Balance:\n\n" \
                        f"👉 **{status_text_en}**\n" \
                        f"• Total Received (Got): ₹{fin['total_got']:,.2f}\n" \
                        f"• Total Given (Gave): ₹{fin['total_gave']:,.2f}\n\n" \
                        f"You can download the statement PDF or send a payment slip below."

        elif intent == "DOWNLOAD_PDF":
            if lang in ["gujlish", "gujarati"]:
                reply = f"📄 **{matched_account.name}** નું લેજર સ્ટેટમેન્ટ PDF તૈયાર છે. ડાઉનલોડ કરવા માટે નીચેનું બટન દબાવો:"
            else:
                reply = f"📄 Ledger statement PDF for **{matched_account.name}** is ready. Click the button below to download:"

        elif intent == "WHATSAPP_REMINDER":
            phone_hint = f" ({matched_account.phone_number})" if matched_account.phone_number else ""
            if lang in ["gujlish", "gujarati"]:
                reply = f"💬 **{matched_account.name}**{phone_hint} માટે WhatsApp પેમેન્ટ સ્લિપ તૈયાર છે. સ્લિપ શેર કરવા અથવા કોપી કરવા નીચે ક્લિક કરો:"
            else:
                reply = f"💬 WhatsApp payment slip for **{matched_account.name}**{phone_hint} is ready to send:"

        elif intent == "RECENT_ENTRIES":
            if lang in ["gujlish", "gujarati"]:
                reply = f"📝 **{matched_account.name}** ની છેલ્લી એન્ટ્રીઓ (કુલ {fin['entries_count']}):\n\n"
            else:
                reply = f"📝 Recent entries for **{matched_account.name}** ({fin['entries_count']} total entries):\n\n"
            
            if fin["recent_entries"]:
                for e in fin["recent_entries"]:
                    type_label = "🟢 GOT (જમા)" if e["type"] == "GOT" else "🔴 GAVE (ઉધાર)"
                    reply += f"• `{e['date']}`: {type_label} **₹{e['amount']:,.2f}** - {e['description'] or 'No note'}\n"
            else:
                reply += "હજી સુધી કોઈ એન્ટ્રી નોંધાયેલ નથી (No entries found).\n"

        else:  # General ACCOUNT_DETAILS
            if lang in ["gujlish", "gujarati"]:
                reply = f"✅ મેં **{matched_account.name}** એકાઉન્ટ ની વિગતો શોધી લીધી છે:\n\n" \
                        f"• **ખાતાધારક**: {matched_account.account_holder or 'N/A'}\n" \
                        f"• **બેંક**: {matched_account.bank_name} ({matched_account.masked_account_number})\n" \
                        f"• **વર્તમાન બેલેન્સ**: **{status_text_gu}**\n"
                if matched_account.phone_number:
                    reply += f"• **ફોન નંબર**: {matched_account.phone_number}\n"
                if matched_account.upi_id:
                    reply += f"• **UPI ID**: `{matched_account.upi_id}`\n"
                if matched_account.credit_limit:
                    reply += f"• **ક્રેડિટ લિમિટ**: ₹{matched_account.credit_limit:,.2f}\n"
                if matched_account.due_date:
                    reply += f"• **ચુકવણી તારીખ**: {matched_account.due_date.strftime('%d %b %Y')}\n"
                reply += f"\nતમે આ એકાઉન્ટ માટે શું કરવા માંગો છો?"
            elif lang == "hinglish":
                reply = f"✅ **{matched_account.name}** Account ki details mil gayi hain:\n\n" \
                        f"• **Holder**: {matched_account.account_holder or 'N/A'}\n" \
                        f"• **Bank**: {matched_account.bank_name} ({matched_account.masked_account_number})\n" \
                        f"• **Current Balance**: **{status_text_en}**\n"
                if matched_account.phone_number:
                    reply += f"• **Phone**: {matched_account.phone_number}\n"
                if matched_account.upi_id:
                    reply += f"• **UPI ID**: `{matched_account.upi_id}`\n"
                reply += f"\nAap is account ke liye kya dekhna chahte hain?"
            else:
                reply = f"✅ Here are the details for **{matched_account.name}**:\n\n" \
                        f"• **Account Holder**: {matched_account.account_holder or 'N/A'}\n" \
                        f"• **Bank**: {matched_account.bank_name} ({matched_account.masked_account_number})\n" \
                        f"• **Current Status**: **{status_text_en}**\n"
                if matched_account.phone_number:
                    reply += f"• **Phone**: {matched_account.phone_number}\n"
                if matched_account.upi_id:
                    reply += f"• **UPI ID**: `{matched_account.upi_id}`\n"
                if matched_account.credit_limit:
                    reply += f"• **Credit Limit**: ₹{matched_account.credit_limit:,.2f}\n"
                if matched_account.due_date:
                    reply += f"• **Due Date**: {matched_account.due_date.strftime('%d %b %Y')}\n"
                reply += f"\nWhat would you like to do next with this account?"

        return {
            "reply": reply,
            "intent": intent,
            "language": lang,
            "matched_account": account_data,
            "clarification_options": [],
            "quick_actions": quick_actions
        }
