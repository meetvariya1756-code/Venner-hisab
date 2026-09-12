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

    def _extract_account_summary(self, pages_data: List[Dict[str, Any]]) -> Dict[str, Optional[float]]:
        """
        Extract Opening Balance, Closing Balance, Total Credits, Total Debits, and Txn Count
        directly from PDF page text and table headers.
        """
        full_text = "\n".join([p.get("text", "") for p in pages_data])
        
        summary = {
            "opening_balance": None,
            "closing_balance": None,
            "total_credits": None,
            "total_debits": None,
            "expected_tx_count": None
        }

        # First, inspect PDF tables directly for summary tables (e.g. SBI Statement Summary)
        for pdata in pages_data:
            tables = pdata.get("tables", [])
            for tbl in tables:
                if not tbl or len(tbl) < 2:
                    continue
                for idx, row in enumerate(tbl):
                    if not row:
                        continue
                    row_str = " ".join([str(c).lower() for c in row if c is not None])
                    if any(k in row_str for k in ["brought forward", "dr count", "cr count", "total debits", "total credits", "closing balance"]):
                        header_cols = [str(c).strip().lower() for c in row if c is not None]
                        data_row = tbl[idx + 1] if idx + 1 < len(tbl) else None
                        if data_row:
                            for col_i, h_text in enumerate(header_cols):
                                if col_i < len(data_row) and data_row[col_i]:
                                    val_str = str(data_row[col_i]).strip()
                                    cleaned_v = clean_amount(val_str)
                                    if cleaned_v > 0 or val_str in ["0", "0.00"]:
                                        if "brought forward" in h_text or "opening balance" in h_text:
                                            if summary["opening_balance"] is None:
                                                summary["opening_balance"] = cleaned_v
                                        elif "closing balance" in h_text or "closing bal" in h_text:
                                            if summary["closing_balance"] is None:
                                                summary["closing_balance"] = cleaned_v
                                        elif "total debits" in h_text or "total withdrawal" in h_text:
                                            if summary["total_debits"] is None:
                                                summary["total_debits"] = cleaned_v
                                        elif "total credits" in h_text or "total deposit" in h_text:
                                            if summary["total_credits"] is None:
                                                summary["total_credits"] = cleaned_v

        if not full_text:
            return summary

        # 1. Opening Balance Patterns
        ob_patterns = [
            r'(?:opening\s+balance|opening\s+bal|brought\s+forward|bal\s+b/f|start\s+balance|opening\s+balance\s*/\s*b/f)(?:\s*\([^)]*\))?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+\.[0-9]{2})(?:\s*[acdrCRDR]{2})?',
            r'(?:b/f|brought\s+forward)\s+balance(?:\s*\([^)]*\))?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+\.[0-9]{2})(?:\s*[acdrCRDR]{2})?',
        ]
        for pat in ob_patterns:
            if summary["opening_balance"] is not None:
                break
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                summary["opening_balance"] = clean_amount(m.group(1))
                break

        # 2. Closing Balance Patterns
        cb_patterns = [
            r'(?:closing\s+balance|closing\s+bal|carried\s+forward|bal\s+c/f|ending\s+balance|closing\s+balance\s*/\s*c/f)(?:\s*\([^)]*\))?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+\.[0-9]{2})(?:\s*[acdrCRDR]{2})?',
            r'(?:c/f|carried\s+forward)\s+balance(?:\s*\([^)]*\))?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+\.[0-9]{2})(?:\s*[acdrCRDR]{2})?',
        ]
        for pat in cb_patterns:
            if summary["closing_balance"] is not None:
                break
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                summary["closing_balance"] = clean_amount(m.group(1))
                break

        # 3. Total Credits / Deposits
        cr_patterns = [
            r'(?:total\s+credit[s]?|total\s+deposit[s]?|total\s+cr)(?:\s*\([^)]*\))?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+\.[0-9]{2})(?:\s*[acdrCRDR]{2})?',
        ]
        for pat in cr_patterns:
            if summary["total_credits"] is not None:
                break
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                summary["total_credits"] = clean_amount(m.group(1))
                break

        # 4. Total Debits / Withdrawals
        dr_patterns = [
            r'(?:total\s+debit[s]?|total\s+withdrawal[s]?|total\s+dr)(?:\s*\([^)]*\))?\s*[:\-]?\s*(?:rs\.?|inr|₹)?\s*([0-9,]+\.[0-9]{2})(?:\s*[acdrCRDR]{2})?',
        ]
        for pat in dr_patterns:
            if summary["total_debits"] is not None:
                break
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                summary["total_debits"] = clean_amount(m.group(1))
                break

        # 5. Expected Txn Count
        cnt_patterns = [
            r'(?:total\s+txn[s]?|total\s+transaction[s]?|txn\s+count|no\.?\s+of\s+txns|total\s+entries)\s*[:\-]?\s*(\d+)',
        ]
        for pat in cnt_patterns:
            m = re.search(pat, full_text, re.IGNORECASE)
            if m:
                try:
                    summary["expected_tx_count"] = int(m.group(1))
                except ValueError:
                    pass
                break

        return summary

    def parse_statement(self, file_path: str, password: Optional[str] = None) -> ParsingResult:
        pages_data = check_and_extract_pdf_pages(file_path, password)
        
        pdf_summary = self._extract_account_summary(pages_data)

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
        last_valid_date: Optional[str] = None
        last_valid_year: Optional[str] = None
        pending_year_prefix: Optional[str] = None
        
        summary_phrases = [
            "brought forward", "carried forward", "opening balance", "closing balance",
            "opening bal", "closing bal", "statement summary", "account summary", "summary of account",
            "total debits", "total credits", "total withdrawal", "total deposit", "total deposits", "total withdrawals",
            "total dr", "total cr", "dr count", "cr count", "statement of account",
            "end of statement", "page number", "page no.", "page no", "generated on", "computer generated",
            "bal c/f", "bal b/f", "balance c/f", "balance b/f", "grand total", "totals"
        ]

        for row in data_rows:
            # Strip page number appended at last position
            p_num = int(row[-1]) if row[-1].isdigit() else 1
            cells = row[:-1]
            
            if not any(cells):
                continue

            row_full_text = " ".join([str(c).strip().lower() for c in cells if c is not None])

            date_val = cells[col_mapping["date"]] if col_mapping.get("date") is not None and col_mapping["date"] < len(cells) else ""
            desc_val = cells[col_mapping["description"]] if col_mapping.get("description") is not None and col_mapping["description"] < len(cells) else ""
            ref_val = cells[col_mapping["ref_no"]] if "ref_no" in col_mapping and col_mapping["ref_no"] < len(cells) else ""
            debit_val = cells[col_mapping["debit"]] if "debit" in col_mapping and col_mapping["debit"] < len(cells) else ""
            credit_val = cells[col_mapping["credit"]] if "credit" in col_mapping and col_mapping["credit"] < len(cells) else ""
            balance_val = cells[col_mapping["balance"]] if "balance" in col_mapping and col_mapping["balance"] < len(cells) else ""

            clean_desc = re.sub(r'\s+', ' ', str(desc_val)).strip()
            clean_date = re.sub(r'[\r\n]+', '', str(date_val)).strip()
            clean_date_lower = clean_date.lower()
            clean_desc_lower = clean_desc.lower()

            # Skip header repeats or summary rows
            if any(sp in row_full_text for sp in summary_phrases):
                continue
            if "particulars" in clean_desc_lower or "date" in clean_date_lower:
                continue

            clean_date_compact = re.sub(r'\s+', '', clean_date)
            
            iso_date = parse_date_string(clean_date)

            # Stitching: If previous page/row left a year prefix like '2026-'
            if not iso_date and re.match(r'^\d{4}-?$', clean_date_compact):
                pending_year_prefix = clean_date_compact[:4]
            elif pending_year_prefix and re.match(r'^\d{2}-?\d{2}$', clean_date_compact):
                stitched = f"{pending_year_prefix}-{clean_date_compact}"
                iso_date = parse_date_string(stitched)
                pending_year_prefix = None
            elif not iso_date and re.match(r'^\d{2}-?\d{2}$', clean_date_compact) and last_valid_year:
                iso_date = parse_date_string(f"{last_valid_year}-{clean_date_compact}")

            # If date cell is NON-EMPTY but cannot be parsed into a date, skip this row (header/footer/summary text)
            if not iso_date and clean_date != "":
                continue

            dr_amt = clean_amount(debit_val)
            cr_amt = clean_amount(credit_val)
            bal_amt = clean_amount(balance_val)

            # Fallback for empty date cell: only if clean_date is completely empty and valid non-numeric narration exists
            if not iso_date and clean_date == "" and last_valid_date and (dr_amt > 0 or cr_amt > 0):
                if clean_desc and not clean_desc.isdigit():
                    iso_date = last_valid_date

            if iso_date:
                last_valid_date = iso_date
                last_valid_year = iso_date[:4]
                # Commit previous transaction if exists
                if current_tx:
                    parsed_transactions.append(NormalizedTransaction(**current_tx))
                
                # Start new transaction
                current_tx = {
                    "date": iso_date,
                    "narration": clean_desc,
                    "ref_no": ref_val if ref_val else None,
                    "debit": dr_amt,
                    "credit": cr_amt,
                    "balance": bal_amt,
                    "page_number": p_num
                }
            else:
                # Multiline continuation row for narration
                if current_tx and clean_desc:
                    current_tx["narration"] += " " + clean_desc
                    if ref_val and not current_tx["ref_no"]:
                        current_tx["ref_no"] = ref_val

        # Commit final transaction
        if current_tx:
            parsed_transactions.append(NormalizedTransaction(**current_tx))

        # Comprehensive filtering pass to remove non-transaction summary/footer rows
        filtered_txs: List[NormalizedTransaction] = []
        for t in parsed_transactions:
            n_lower = t.narration.strip().lower()
            ref_lower = (t.ref_no or "").strip().lower()
            combined_text = f"{n_lower} {ref_lower}".strip()

            # 1. Direct summary phrase match anywhere in narration or ref
            if any(sp in combined_text for sp in summary_phrases):
                continue

            # 2. Purely numeric or count-like narration (e.g. '25', '35', '1', '10 25', 'cr count')
            is_digit_like = n_lower.isdigit() or bool(re.match(r'^\d+(\s+\d+)*$', n_lower)) or bool(re.search(r'\b(cr|dr)\s+count\b', combined_text))
            
            # 3. Check if amounts match PDF summary metrics (closing balance, total debits, total credits)
            is_zero_balance = (t.balance == 0.0)
            matches_pdf_closing = (pdf_summary["closing_balance"] is not None and abs(t.credit - pdf_summary["closing_balance"]) < 0.01)
            matches_pdf_closing_debit = (pdf_summary["closing_balance"] is not None and abs(t.debit - pdf_summary["closing_balance"]) < 0.01)
            matches_pdf_total_dr = (pdf_summary["total_debits"] is not None and (abs(t.debit - pdf_summary["total_debits"]) < 0.01 or abs(t.credit - pdf_summary["total_debits"]) < 0.01))
            matches_pdf_total_cr = (pdf_summary["total_credits"] is not None and (abs(t.credit - pdf_summary["total_credits"]) < 0.01 or abs(t.debit - pdf_summary["total_credits"]) < 0.01))

            ref_amt = clean_amount(t.ref_no)
            ref_matches_totals = (
                (pdf_summary["total_debits"] is not None and abs(ref_amt - pdf_summary["total_debits"]) < 0.01) or
                (pdf_summary["total_credits"] is not None and abs(ref_amt - pdf_summary["total_credits"]) < 0.01)
            )

            # 4. Check balance continuity if previous transaction exists
            balance_continuity_broken = False
            if len(filtered_txs) > 0:
                prev_bal = filtered_txs[-1].balance
                expected_bal = round(prev_bal + t.credit - t.debit, 2)
                if abs(expected_bal - t.balance) > 0.05:
                    balance_continuity_broken = True

            # Filter out summary data rows
            if is_digit_like and (is_zero_balance or matches_pdf_closing or matches_pdf_total_dr or ref_matches_totals or balance_continuity_broken):
                continue

            if matches_pdf_closing and ref_matches_totals:
                continue

            if balance_continuity_broken and (matches_pdf_closing or matches_pdf_closing_debit or is_zero_balance or t.balance == t.credit or ref_matches_totals):
                continue

            filtered_txs.append(t)

        # Deduplicate exact duplicate transactions generated by multi-page table splits
        dedup_txs: List[NormalizedTransaction] = []
        for t in filtered_txs:
            if dedup_txs:
                last_t = dedup_txs[-1]
                if (t.date == last_t.date and 
                    t.narration == last_t.narration and 
                    t.debit == last_t.debit and 
                    t.credit == last_t.credit and 
                    t.balance == last_t.balance):
                    continue
            dedup_txs.append(t)

        parsed_transactions = dedup_txs

        # Compute summary metrics
        total_credits = round(sum(t.credit for t in parsed_transactions), 2)
        total_debits = round(sum(t.debit for t in parsed_transactions), 2)
        
        start_date = parsed_transactions[0].date if parsed_transactions else None
        end_date = parsed_transactions[-1].date if parsed_transactions else None
        year_month = start_date[:7] if start_date else None
        
        # Calculate opening balance: prefer PDF summary if available, else initial transaction balance shift
        if pdf_summary["opening_balance"] is not None:
            opening_bal = round(pdf_summary["opening_balance"], 2)
        elif parsed_transactions:
            opening_bal = round(parsed_transactions[0].balance - (parsed_transactions[0].credit - parsed_transactions[0].debit), 2)
        else:
            opening_bal = 0.0

        # Calculate closing balance: prefer PDF summary if available, else last valid transaction balance
        if pdf_summary["closing_balance"] is not None:
            closing_bal = round(pdf_summary["closing_balance"], 2)
        elif parsed_transactions and parsed_transactions[-1].balance > 0:
            closing_bal = round(parsed_transactions[-1].balance, 2)
        elif parsed_transactions:
            closing_bal = round(opening_bal + total_credits - total_debits, 2)
        else:
            closing_bal = 0.0

        # Reconcile expected closing balance
        expected_closing = round(opening_bal + total_credits - total_debits, 2)

        warnings = []
        if parsed_transactions:
            if abs(expected_closing - closing_bal) > 0.05:
                # Disparity detected: if PDF summary provided closing balance, align closing balance
                if pdf_summary["closing_balance"] is not None:
                    closing_bal = pdf_summary["closing_balance"]
                else:
                    warnings.append(
                        f"Reconciliation disparity: Opening ({opening_bal}) + Credits ({total_credits}) - Debits ({total_debits}) = {expected_closing}, but statement closing balance is {closing_bal}."
                    )

        full_text_lower = " ".join([p.get("text", "") for p in pages_data]).lower() + str(all_raw_rows).lower()
        if "indusind" in full_text_lower:
            detected_bank = "IndusInd Bank"
        elif "kotak" in full_text_lower:
            detected_bank = "Kotak Mahindra Bank"
        elif "sbi" in full_text_lower or "state bank" in full_text_lower:
            detected_bank = "State Bank of India"
        elif "hdfc" in full_text_lower:
            detected_bank = "HDFC Bank"
        elif "icici" in full_text_lower:
            detected_bank = "ICICI Bank"
        else:
            detected_bank = "Generic Bank"

        return ParsingResult(
            bank_name=detected_bank,
            opening_balance=opening_bal,
            closing_balance=closing_bal,
            start_date=start_date,
            end_date=end_date,
            year_month=year_month,
            total_credits=total_credits,
            total_debits=total_debits,
            transactions=parsed_transactions,
            raw_rows=all_raw_rows,
            warnings=warnings
        )

    def _parse_from_text(self, pages_data: List[Dict[str, Any]]) -> ParsingResult:
        # Simple text fallback parser
        parsed = []
        pdf_summary = self._extract_account_summary(pages_data)
        
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

        total_cr = round(sum(t.credit for t in parsed), 2)
        total_dr = round(sum(t.debit for t in parsed), 2)
        start = parsed[0].date if parsed else None
        end = parsed[-1].date if parsed else None

        opening_bal = pdf_summary["opening_balance"] if pdf_summary["opening_balance"] is not None else (
            round(parsed[0].balance - (parsed[0].credit - parsed[0].debit), 2) if parsed else 0.0
        )
        closing_bal = pdf_summary["closing_balance"] if pdf_summary["closing_balance"] is not None else (
            round(parsed[-1].balance, 2) if parsed else 0.0
        )

        return ParsingResult(
            opening_balance=opening_bal,
            closing_balance=closing_bal,
            transactions=parsed,
            total_credits=total_cr,
            total_debits=total_dr,
            start_date=start,
            end_date=end,
            year_month=start[:7] if start else None
        )

