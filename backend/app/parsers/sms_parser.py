import re
from datetime import datetime
from typing import Dict, Any, Optional, List

class SMSParser:
    """
    Intelligent parser for Indian Bank & UPI Transaction SMS/Notification texts.
    Supports HDFC, SBI, ICICI, Axis, Kotak, BoB, PNB, GPay, Paytm, PhonePe, and generic bank formats.
    """

    @staticmethod
    def parse(sms_text: str) -> Dict[str, Any]:
        text = sms_text.strip()
        if not text:
            return {"success": False, "error": "Empty text provided"}

        # 1. Detect Transaction Type (DEBIT vs CREDIT)
        tx_type = "DEBIT" # default
        lower_text = text.lower()
        
        credit_keywords = ["credited", "received", "deposited", "added to", "refund of", "cr to", "credited with"]
        debit_keywords = ["debited", "sent", "paid", "spent", "withdrawn", "dr from", "transferred to", "deducted", "purchase of"]

        is_credit = any(k in lower_text for k in credit_keywords)
        is_debit = any(k in lower_text for k in debit_keywords)

        if is_credit and not is_debit:
            tx_type = "CREDIT"
        elif is_debit:
            tx_type = "DEBIT"
        elif "cr" in lower_text.split():
            tx_type = "CREDIT"
        elif "dr" in lower_text.split():
            tx_type = "DEBIT"

        # 2. Extract Amount (Rs. / INR / ₹ / Rs)
        amount = None
        amount_patterns = [
            r'(?:(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?))',
            r'(?:debited\s*(?:by|for)?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?))',
            r'(?:credited\s*(?:by|with)?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?))',
            r'(?:(?:paid|sent|received)\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?))',
            r'(?:amount\s*(?:of)?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{1,2})?))'
        ]

        for pat in amount_patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_amt = match.group(1).replace(',', '')
                try:
                    val = float(raw_amt)
                    if val > 0:
                        amount = round(val, 2)
                        break
                except ValueError:
                    continue

        # Fallback amount regex for any standalone currency-like float
        if amount is None:
            match = re.search(r'\b(?:[\d,]+(?:\.\d{2}))\b', text)
            if match:
                try:
                    amount = round(float(match.group(0).replace(',', '')), 2)
                except ValueError:
                    pass

        # 3. Extract Reference / UTR Number
        ref_no = None
        ref_patterns = [
            r'(?:UPI\s*Ref(?:\s*no\.?|\s*no|:|\/)?\s*(\w+))',
            r'(?:Ref(?:\s*no\.?|\s*no|:|\/)?\s*(\w+))',
            r'(?:UTR(?:\s*no\.?|:|\/)?\s*(\w+))',
            r'(?:Txn\s*ID(?:\s*no\.?|:|\/)?\s*(\w+))',
            r'(?:Info:\s*UPI\/(\w+))',
            r'(?:RRN(?:\s*:|\s*)?(\w+))'
        ]
        for pat in ref_patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                ref_no = match.group(1).strip()
                break

        # 4. Extract Account Number / Masked Card
        account_no = None
        acc_patterns = [
            r'(?:(?:A\/C|Acct|Account|card|ending)\s*(?:no\.?|is)?\s*[:*xX-]*(\d{3,6}))',
            r'(?:A\/C\s*[*xX]+(\d{3,6}))',
            r'(?:XX(\d{4}))'
        ]
        for pat in acc_patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                account_no = match.group(1)
                break

        # 5. Extract Payee / Beneficiary / Merchant Name
        payee = None
        payee_patterns = [
            r'(?:(?:to|towards|at|vpa|linked to VPA)\s+([A-Za-z0-9\.\-_@ &]{2,35}))(?:\s+on\s+|\s+ref\s*|\s+avail|\s+balance|\s+info|\.|\,|$)',
            r'(?:(?:from|by)\s+([A-Za-z0-9\.\-_@ &]{2,35}))(?:\s+on\s+|\s+ref\s*|\s+avail|\s+balance|\s+info|\.|\,|$)',
            r'(?:Info:\s*UPI\/\w+\/([A-Za-z0-9\.\-_@ ]+))',
            r'(?:transfer\s*to\s*([A-Za-z0-9\.\-_@ ]+))'
        ]
        for pat in payee_patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                candidate = match.group(1).strip().strip('.')
                # Clean up noise words
                clean_candidate = re.sub(r'^(account|a\/c|vpa|dr|cr|inr|rs)\s+', '', candidate, flags=re.IGNORECASE).strip()
                # Remove trailing markers like 'Ref', 'Ref No'
                clean_candidate = re.sub(r'\s+(ref|utr|rrn|txn|no|on).*$', '', clean_candidate, flags=re.IGNORECASE).strip().strip('.')
                if len(clean_candidate) >= 2 and not clean_candidate.lower().startswith(('hdfc', 'sbi', 'icici', 'axis', 'kotak', 'bank')):
                    payee = clean_candidate
                    break

        # 6. Extract Date
        date_str = datetime.now().strftime("%Y-%m-%d")
        date_patterns = [
            r'(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})',
            r'(\d{1,2}-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2,4})',
            r'(\d{1,2}\s*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s*\d{2,4})'
        ]
        for pat in date_patterns:
            match = re.search(pat, text, re.IGNORECASE)
            if match:
                raw_d = match.group(1).strip()
                for fmt in ["%d-%m-%Y", "%d/%m/%Y", "%d-%m-%y", "%d/%m/%y", "%d-%b-%Y", "%d-%b-%y", "%d %b %Y", "%d %b %y"]:
                    try:
                        parsed = datetime.strptime(raw_d, fmt)
                        date_str = parsed.strftime("%Y-%m-%d")
                        break
                    except ValueError:
                        pass
                break

        # Generate narration description
        if payee:
            narration = f"UPI / Transfer - {payee}" if not ref_no else f"UPI {payee} (Ref: {ref_no})"
        elif ref_no:
            narration = f"Bank Transfer (Ref: {ref_no})"
        else:
            narration = "Quick SMS Ingested Transaction"

        return {
            "success": True if amount is not None else False,
            "raw_text": text,
            "type": tx_type,
            "amount": amount,
            "date": date_str,
            "reference_number": ref_no,
            "account_number_hint": account_no,
            "payee": payee,
            "suggested_narration": narration
        }

    @staticmethod
    def parse_batch(sms_texts: List[str]) -> List[Dict[str, Any]]:
        return [SMSParser.parse(text) for text in sms_texts if text.strip()]
