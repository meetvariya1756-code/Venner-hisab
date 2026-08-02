import unittest
from app.core.database import SessionLocal, engine, Base
from app.core.default_data import seed_default_data
from app.models.account import BankAccount
from app.models.khatabook_entry import KhatabookEntry
from app.api.khatabook import (
    create_khatabook_entry,
    get_khatabook_account_entries,
    get_khatabook_summary,
    get_khatabook_accounts,
    delete_khatabook_entry
)

class TestKhatabookManualEntries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        seed_default_data(cls.db)

        acc = cls.db.query(BankAccount).first()
        if not acc:
            acc = BankAccount(name="Test Store", bank_name="SBI", account_number="123456", opening_balance=0)
            cls.db.add(acc)
            cls.db.commit()
            cls.db.refresh(acc)
        cls.account_id = acc.id

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_create_gave_and_got_entries(self):
        # Create GAVE entry (e.g. BARFI-PC-2 8 BARFI-PC-3 30)
        res_gave = create_khatabook_entry(
            account_id=self.account_id,
            entry_type="GAVE",
            amount=4180.0,
            description="BARFI-PC-2 8 BARFI-PC-3 30",
            entry_date="2026-08-01",
            bill_file=None,
            db=self.db
        )
        self.assertTrue(res_gave["success"])
        gave_id = res_gave["entry_id"]

        # Create GOT entry
        res_got = create_khatabook_entry(
            account_id=self.account_id,
            entry_type="GOT",
            amount=5000.0,
            description="Payment received online",
            entry_date="2026-08-02",
            bill_file=None,
            db=self.db
        )
        self.assertTrue(res_got["success"])
        got_id = res_got["entry_id"]

        # Fetch entries
        entries_res = get_khatabook_account_entries(self.account_id, self.db)
        self.assertEqual(entries_res["account"]["id"], self.account_id)
        self.assertGreaterEqual(len(entries_res["entries"]), 2)

        # Cleanup created test entries
        delete_khatabook_entry(gave_id, self.db)
        delete_khatabook_entry(got_id, self.db)

if __name__ == "__main__":
    unittest.main()
