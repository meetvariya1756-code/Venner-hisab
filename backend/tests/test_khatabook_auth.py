import unittest
from app.core.database import SessionLocal, engine, Base
from app.core.default_data import seed_default_data
from app.api.auth import login, LoginRequest
from app.api.khatabook import get_khatabook_summary, get_khatabook_accounts

class TestKhatabookAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.db = SessionLocal()
        seed_default_data(cls.db)

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_owner_login(self):
        payload = LoginRequest(username="owner", password="owner123")
        res = login(payload, self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["user"]["role"], "owner")

    def test_venner_owner_login(self):
        payload = LoginRequest(username="Venner Enterprise", password="Venner@Enterprise")
        res = login(payload, self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["user"]["role"], "owner")

    def test_manager_login(self):
        payload = LoginRequest(username="manager", password="manager123")
        res = login(payload, self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["user"]["role"], "manager")

    def test_khatabook_summary(self):
        res = get_khatabook_summary(self.db)
        self.assertIn("total_give", res)
        self.assertIn("total_get", res)
        self.assertIn("accounts_count", res)

    def test_khatabook_accounts_filtering_and_sorting(self):
        # Test 'all' filter
        res_all = get_khatabook_accounts(q=None, filter_by="all", sort_by="recent", db=self.db)
        self.assertIn("accounts", res_all)

        # Test 'give' filter
        res_give = get_khatabook_accounts(q=None, filter_by="give", sort_by="highest", db=self.db)
        for acc in res_give["accounts"]:
            self.assertEqual(acc["status"], "YOU'LL GIVE")

        # Test 'get' filter
        res_get = get_khatabook_accounts(q=None, filter_by="get", sort_by="oldest", db=self.db)
        for acc in res_get["accounts"]:
            self.assertEqual(acc["status"], "YOU'LL GET")

if __name__ == "__main__":
    unittest.main()
