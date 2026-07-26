import re
import os
import glob
import json
from typing import List, Dict, Any, Optional
from app.parsers.base import ParsingResult, NormalizedTransaction
from app.parsers.pdf_extractor import check_and_extract_pdf_pages
from app.parsers.detector import detect_column_indices, clean_amount, parse_date_string

class StatementParserEngine:
    def __init__(self):
        self.configs = self._load_configs()

    def _load_configs(self) -> List[Dict[str, Any]]:
        configs = []
        config_dir = os.path.join(os.path.dirname(__file__), "configs")
        if os.path.exists(config_dir):
            for path in glob.glob(os.path.join(config_dir, "*.json")):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        configs.append(json.load(f))
                except Exception:
                    pass
        return configs

    def parse_statement(self, file_path: str, password: Optional[str] = None) -> ParsingResult:
        pages_data = check_and_extract_pdf_pages(file_path, password)
        
        all_raw_rows: List[List[str]] = []
        parsed_transactions: List[NormalizedTransaction] = []
        
        # Aggregate tables across pages
        for pdata in pages_data:
            p_num = pdata["page_number"]
            tables = pdata.get("tables", [])
            
            for tbl in tables:
                if not tbl:
                    continue
                for row in tbl:
                    if not row:
                        continue
                    # Clean empty cells
                    cleaned_row = [str(cell).strip() if cell is not None else "" for cell in row]
                    if any(cleaned_row):
                        all_raw_rows.append(cleaned_row + [str(p_num)])

        if not all_raw_rows:
            # Fallback: Parse line-by-line from plain text if no PDF tables detected
            return self._parse_from_text(pages_data)

        # Detect Header Row
        header_idx = -1
        col_mapping = {}

        for idx, row in enumerate(all_raw_rows):
            detected = detect_column_indices(row[:-1])
            # We need at least date, description, and (debit or credit or balance)
            if "date" in detected and "description" in detected and len(detected) >= 3:
                header_idx = idx
                col_mapping = detected
                break

        if header_idx == -1:
            # Try fuzzy search without strict date header if date column found by regex
            col_mapping = {"date": 1, "description": 2, "ref_no": 3, "debit": 4, "credit": 5, "balance": 6}
            header_idx = 0

        # Extract transactions
        data_rows = all_raw_rows[header_idx + 1:]
        
        current_tx: Optional[Dict[str, Any]] = None
        
        for row in data_rows:
            # Strip page number appended at last position
            p_num = int(row[-1]) if row[-1].isdigit() else 1
            cells = row[:-1]
            
            if not any(cells):
                continue

            date_val = cells[col_mapping["date"]] if col_mapping.get("date") < len(cells) else ""
            desc_val = cells[col_mapping["description"]] if col_mapping.get("description") < len(cells) else ""
            ref_val = cells[col_mapping["ref_no"]] if "ref_no" in col_mapping and col_mapping["ref_no"] < len(cells) else ""
            debit_val = cells[col_mapping["debit"]] if "debit" in col_mapping and col_mapping["debit"] < len(cells) else ""
            credit_val = cells[col_mapping["credit"]] if "credit" in col_mapping and col_mapping["credit"] < len(cells) else ""
            balance_val = cells[col_mapping["balance"]] if "balance" in col_mapping and col_mapping["balance"] < len(cells) else ""

            # Check if this row starts a new transaction (valid date present)
            iso_date = parse_date_string(date_val)
            
            # Skip header repeats or summary rows
            if "opening balance" in desc_val.lower() or "closing balance" in desc_val.lower() or "description" in desc_val.lower():
                continue

            if iso_date:
                # Commit previous transaction if exists
                if current_tx:
                    parsed_transactions.append(NormalizedTransaction(**current_tx))
                
                # Start new transaction
                current_tx = {
                    "date": iso_date,
                    "narration": desc_val,
                    "ref_no": ref_val if ref_val else None,
                    "debit": clean_amount(debit_val),
                    "credit": clean_amount(credit_val),
                    "balance": clean_amount(balance_val),
                    "page_number": p_num
                }
            else:
                # Multiline continuation row for narration
                if current_tx and desc_val:
                    current_tx["narration"] += " " + desc_val
                    if ref_val and not current_tx["ref_no"]:
                        current_tx["ref_no"] = ref_val

        # Commit final transaction
        if current_tx:
            parsed_transactions.append(NormalizedTransaction(**current_tx))

        # Compute summary metrics
        total_credits = sum(t.credit for t in parsed_transactions)
        total_debits = sum(t.debit for t in parsed_transactions)
        
        start_date = parsed_transactions[0].date if parsed_transactions else None
        end_date = parsed_transactions[-1].date if parsed_transactions else None
        year_month = start_date[:7] if start_date else None
        
        opening_bal = parsed_transactions[0].balance - (parsed_transactions[0].credit - parsed_transactions[0].debit) if parsed_transactions else 0.0
        closing_bal = parsed_transactions[-1].balance if parsed_transactions else 0.0

        return ParsingResult(
            bank_name="Kotak Mahindra Bank" if "kotak" in str(all_raw_rows).lower() else "Generic Bank",
            opening_balance=opening_bal,
            closing_balance=closing_bal,
            start_date=start_date,
            end_date=end_date,
            year_month=year_month,
            total_credits=total_credits,
            total_debits=total_debits,
            transactions=parsed_transactions,
            raw_rows=all_raw_rows
        )

    def _parse_from_text(self, pages_data: List[Dict[str, Any]]) -> ParsingResult:
        # Simple text fallback parser
        parsed = []
        for pdata in pages_data:
            lines = pdata.get("text", "").splitlines()
            for line in lines:
                # Match line with date and amounts
                date_match = re.search(r'\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{2}/\d{2}/\d{4})\b', line)
                if date_match:
                    d_str = parse_date_string(date_match.group(1))
                    if d_str:
                        amounts = re.findall(r'\b\d{1,3}(?:,\d{3})*(?:\.\d{2})\b', line)
                        debit = clean_amount(amounts[0]) if len(amounts) > 1 else 0.0
                        credit = clean_amount(amounts[1]) if len(amounts) > 2 else (clean_amount(amounts[0]) if len(amounts) == 1 else 0.0)
                        bal = clean_amount(amounts[-1]) if amounts else 0.0
                        parsed.append(NormalizedTransaction(
                            date=d_str,
                            narration=line.strip(),
                            debit=debit,
                            credit=credit,
                            balance=bal,
                            page_number=pdata["page_number"]
                        ))

        total_cr = sum(t.credit for t in parsed)
        total_dr = sum(t.debit for t in parsed)
        start = parsed[0].date if parsed else None
        end = parsed[-1].date if parsed else None

        return ParsingResult(
            transactions=parsed,
            total_credits=total_cr,
            total_debits=total_dr,
            start_date=start,
            end_date=end,
            year_month=start[:7] if start else None
        )
