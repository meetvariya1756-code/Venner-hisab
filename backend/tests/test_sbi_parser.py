import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.parsers.generic_parser import StatementParserEngine
from app.parsers.base import ParsingResult, NormalizedTransaction
from app.services.statement_service import StatementService


class TestSBIAndMultiBankParser(unittest.TestCase):
    def setUp(self):
        self.engine = StatementParserEngine()

    @patch("app.parsers.generic_parser.check_and_extract_pdf_pages")
    def test_sbi_fabreecart_summary_and_35_tx_filtering(self, mock_pdf_extractor):
        """
        Simulate SBI FABREECART statement with 35 actual transactions plus 1 summary footer row
        (Date: 2026-08-31, Narration: '25', Debit: 1,14,467.00, Credit: 27,743.34, Balance: 0.00).
        """
        page1_text = """
        STATE BANK OF INDIA
        STATEMENT OF ACCOUNT: FABREECART
        ACCOUNT SUMMARY:
        Opening Balance: 14,567.67
        Total Deposit: 1,55,386.01
        Total Withdrawal: 2,42,109.67
        Closing Balance: 27,743.34
        Total Txns: 35
        """

        # Generate 35 valid transaction rows
        table_rows = [
            ["Txn Date", "Description", "Ref No", "Withdrawal (Dr.)", "Deposit (Cr.)", "Balance"]
        ]

        curr_bal = 14567.67
        # 34 standard transactions + 35th transaction to balance total credits to 127,642.67 and total debits to 114,467.00
        # Net shift needed: 13,175.67
        for i in range(1, 35):
            if i % 2 == 1:
                cr = 3000.00
                dr = 0.0
                curr_bal = round(curr_bal + cr, 2)
            else:
                cr = 0.0
                dr = 2000.00
                curr_bal = round(curr_bal - dr, 2)

            table_rows.append([
                f"2026-08-{i:02d}" if i <= 30 else "2026-08-31",
                f"Txn Entry Number {i} Narration",
                f"REF{1000+i}",
                f"{dr:.2f}" if dr > 0 else "-",
                f"{cr:.2f}" if cr > 0 else "-",
                f"{curr_bal:.2f}"
            ])

        # 35th transaction to adjust final balance to 27,743.34
        # 17 credits of 3000 = 51,000. 17 debits of 2000 = 34,000. Net shift so far = 17,000.
        # Target net shift = 13,175.67. Need debit of 3,824.33 on 35th transaction.
        dr_35 = 3824.33
        curr_bal = round(curr_bal - dr_35, 2)  # 14567.67 + 17000 - 3824.33 = 27743.34
        table_rows.append([
            "2026-08-31",
            "Txn Entry Number 35 Narration",
            "REF1035",
            f"{dr_35:.2f}",
            "-",
            f"{curr_bal:.2f}"
        ])

        # Add the problematic 36th summary row that SBI outputs at the bottom of the table
        table_rows.append([
            "2026-08-31",
            "25",
            "",
            "1,14,467.00",
            "27,743.34",
            "0.00"
        ])

        mock_pdf_extractor.return_value = [
            {
                "page_number": 1,
                "text": page1_text,
                "tables": [table_rows]
            }
        ]

        result = self.engine.parse_statement("dummy_path.pdf")

        # 1. Assert exact transaction count is 35 (not 36)
        self.assertEqual(len(result.transactions), 35, f"Expected 35 transactions, got {len(result.transactions)}")

        # 2. Assert Opening Balance is 14567.67
        self.assertEqual(result.opening_balance, 14567.67)

        # 3. Assert Closing Balance is 27743.34 (not 0.00)
        self.assertEqual(result.closing_balance, 27743.34)

        # 4. Assert math reconciliation
        expected_cb = round(result.opening_balance + result.total_credits - result.total_debits, 2)
        self.assertAlmostEqual(expected_cb, result.closing_balance, delta=0.05)

        # 5. Test Monthly Chunk calculation
        chunks = StatementService.split_parsing_result_by_month(result)
        self.assertEqual(len(chunks), 1)
        self.assertEqual(len(chunks[0].transactions), 35)
        self.assertEqual(chunks[0].opening_balance, 14567.67)
        self.assertEqual(chunks[0].closing_balance, 27743.34)

    @patch("app.parsers.generic_parser.check_and_extract_pdf_pages")
    def test_kotak_bank_statement_summary(self, mock_pdf_extractor):
        """
        Simulate Kotak Mahindra Bank statement format.
        """
        page_text = """
        KOTAK MAHINDRA BANK STATEMENT
        Account Summary:
        Opening Bal: 25,000.00
        Closing Bal: 42,500.00
        """

        table_rows = [
            ["Date", "Narration", "Chq/Ref No", "Withdrawal (Dr)", "Deposit (Cr)", "Balance"],
            ["01/02/2026", "SALARY CREDIT", "REF001", "-", "25,000.00", "50,000.00"],
            ["05/02/2026", "RENT PAYMENT", "REF002", "7,500.00", "-", "42,500.00"]
        ]

        mock_pdf_extractor.return_value = [
            {
                "page_number": 1,
                "text": page_text,
                "tables": [table_rows]
            }
        ]

        result = self.engine.parse_statement("dummy_kotak.pdf")
        self.assertEqual(len(result.transactions), 2)
        self.assertEqual(result.opening_balance, 25000.00)
        self.assertEqual(result.closing_balance, 42500.00)
        self.assertEqual(result.total_credits, 25000.00)
        self.assertEqual(result.total_debits, 7500.00)
        self.assertEqual(result.bank_name, "Kotak Mahindra Bank")


    @patch("app.parsers.generic_parser.check_and_extract_pdf_pages")
    def test_sbi_statement_summary_table_isolation(self, mock_pdf_extractor):
        """
        Simulate exact SBI PDF Page 4 structure with separate Statement Summary table at bottom.
        Ensures Statement Summary rows are completely ignored during transaction extraction,
        and summary metrics are extracted accurately.
        """
        main_table = [
            ["Value Date", "Post Date", "Details", "Ref No/ Cheque No", "₹ Debit", "₹ Credit", "Balance"],
            ["01/08/2026", "01/08/2026", "WDL TFR UPI/DR/621311509090", "-", "7,000.00", "-", "7,567.67"],
            ["31/08/2026", "31/08/2026", "DEP TFR NEFT*UTIB0001541*AXISCN1452", "-", "-", "17,579.84", "29,243.34"],
            ["31/08/2026", "31/08/2026", "WDL TFR UPI/DR/624355634658/ASHOKBHA", "-", "1,500.00", "-", "27,743.34"]
        ]

        summary_table = [
            ["Brought Forward (₹)", "Dr Count", "Cr Count", "Total Debits(₹)", "Total Credits(₹)", "Closing Balance (₹)"],
            ["14,567.67CR", "10", "25", "1,14,467.00", "1,27,642.67", "27,743.34CR"]
        ]

        mock_pdf_extractor.return_value = [
            {
                "page_number": 4,
                "text": "Statement Summary : 01-08-2026 To 31-08-2026\nBrought Forward (₹) Dr Count Cr Count Total Debits(₹) Total Credits(₹) Closing Balance (₹)\n14,567.67CR 10 25 1,14,467.00 1,27,642.67 27,743.34CR",
                "tables": [main_table, summary_table]
            }
        ]

        result = self.engine.parse_statement("sbi_page4.pdf")

        # Must have exactly 3 transactions from main table
        self.assertEqual(len(result.transactions), 3)
        self.assertEqual(result.transactions[-1].narration, "WDL TFR UPI/DR/624355634658/ASHOKBHA")
        self.assertEqual(result.transactions[-1].balance, 27743.34)
        self.assertEqual(result.opening_balance, 14567.67)
        self.assertEqual(result.closing_balance, 27743.34)
        self.assertEqual(result.total_debits, 8500.00)
        self.assertEqual(result.total_credits, 17579.84)


if __name__ == "__main__":
    unittest.main()

