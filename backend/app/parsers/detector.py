import re
from typing import List, Dict, Optional, Tuple
from datetime import datetime

SYNONYMS = {
    "date": ["date", "txn date", "transaction date", "value date", "dt"],
    "description": ["description", "narration", "particulars", "details", "remarks"],
    "ref_no": ["chq/ref. no.", "chq/ref.no.", "chq/ref no", "ref no", "cheque no", "ref.no.", "txn id", "chq.no"],
    "debit": ["withdrawal (dr.)", "withdrawal", "debit", "dr amount", "dr.", "dr"],
    "credit": ["deposit (cr.)", "deposit", "credit", "cr amount", "cr.", "cr"],
    "balance": ["balance", "closing balance", "running balance"]
}

def clean_amount(val: str) -> float:
    if not val:
        return 0.0
    val_str = str(val).strip().replace(",", "").replace("₹", "").replace("Rs", "").strip()
    if not val_str or val_str == "-" or val_str == ".":
        return 0.0
    # Handle Dr/Cr suffixes
    val_str = re.sub(r'(?i)\s*(dr|cr)$', '', val_str).strip()
    try:
        return float(val_str)
    except ValueError:
        return 0.0

def parse_date_string(date_str: str) -> Optional[str]:
    if not date_str:
        return None
    # Remove internal linebreaks and collapse multiline date fragments (e.g. '2026-\n03-31' -> '2026-03-31')
    cleaned = re.sub(r'[\r\n]+', '', str(date_str)).strip()
    cleaned = re.sub(r'\s+', ' ', cleaned)
    # Remove spaces around dashes or slashes in dates like '2026 - 03 - 31'
    cleaned = re.sub(r'(\d{2,4})\s*[\-/]\s*(\d{1,2})\s*[\-/]\s*(\d{1,4})', r'\1-\2-\3', cleaned)
    
    # Strip time portion if present (e.g., '17/08/2026 14:22:00' or '17-08-2026 02:30 PM')
    cleaned = re.sub(r'\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?', '', cleaned, flags=re.IGNORECASE).strip()
    
    formats = [
        "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y", "%d %B %Y",
        "%d.%m.%Y", "%d-%b-%Y", "%d-%b-%y", "%d/%m/%y", "%d-%m-%y", "%d.%m.%y",
        "%b %d, %Y", "%B %d, %Y"
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass
    return None

def detect_column_indices(headers: List[str]) -> Dict[str, int]:
    mapping = {}
    normalized = [str(h).strip().lower() for h in headers if h is not None]

    for col_key, syn_list in SYNONYMS.items():
        found_idx = -1
        for syn in syn_list:
            for idx, raw_h in enumerate(normalized):
                if syn in raw_h:
                    found_idx = idx
                    break
            if found_idx != -1:
                break
        if found_idx != -1:
            mapping[col_key] = found_idx

    return mapping
