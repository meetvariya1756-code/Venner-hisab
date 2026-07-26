from sqlalchemy.orm import Session
from app.models.platform import Platform
from app.models.category import Category
from app.models.party import Party
from app.models.rule import CategorizationRule

DEFAULT_PLATFORMS = [
    {"id": 1, "name": "Meesho", "code": "MEESHO", "description": "Meesho Marketplace Seller Accounts"},
    {"id": 2, "name": "Flipkart", "code": "FLIPKART", "description": "Flipkart Marketplace Seller Accounts"},
    {"id": 3, "name": "Amazon", "code": "AMAZON", "description": "Amazon Seller Central Accounts"},
    {"id": 4, "name": "Direct Party / Vendors", "code": "OTHER", "description": "Direct Party Payments & Vendor Accounts"},
]

DEFAULT_CATEGORIES = [
    # INCOME Categories
    {"id": 1, "name": "Marketplace Sales – Meesho", "type": "INCOME", "parent_id": None, "color": "#ec4899"},
    {"id": 2, "name": "Marketplace Sales – Flipkart", "type": "INCOME", "parent_id": None, "color": "#2563eb"},
    {"id": 3, "name": "Marketplace Sales – Amazon", "type": "INCOME", "parent_id": None, "color": "#f59e0b"},
    {"id": 4, "name": "Marketplace Sales – Other", "type": "INCOME", "parent_id": None, "color": "#10b981"},
    {"id": 5, "name": "Other Income", "type": "INCOME", "parent_id": None, "color": "#06b6d4"},
    
    # EXPENSE Categories
    {"id": 6, "name": "Vendor Payments", "type": "EXPENSE", "parent_id": None, "color": "#ef4444"},
    {"id": 7, "name": "Rent", "type": "EXPENSE", "parent_id": None, "color": "#8b5cf6"},
    {"id": 8, "name": "Salaries", "type": "EXPENSE", "parent_id": None, "color": "#6366f1"},
    {"id": 9, "name": "Fees & Bank Charges", "type": "EXPENSE", "parent_id": None, "color": "#f97316"},
    {"id": 10, "name": "Other Expense", "type": "EXPENSE", "parent_id": None, "color": "#64748b"},
]

DEFAULT_PARTIES = [
    {"name": "Meesho", "category_id": 1, "aliases": '["MEESHO TECHNOLOGIES", "MEESHO", "MEESHOPAY", "MEESHO PAYMEN", "MESHO SETTLE"]'},
    {"name": "Flipkart", "category_id": 2, "aliases": '["FLIPKART", "FKMP", "INSTAKART"]'},
    {"name": "Amazon", "category_id": 3, "aliases": '["AMAZON", "ATVP", "AMZN"]'},
    {"name": "BharatPe", "category_id": 4, "aliases": '["BHARATPE", "PAY TO BHARATPE"]'},
]

DEFAULT_RULES = [
    {
        "name": "Meesho Settlement Rule",
        "pattern": "MEESHO",
        "match_type": "KEYWORD",
        "party_id": 1,
        "category_id": 1,
        "priority": 1,
    },
    {
        "name": "Flipkart Settlement Rule",
        "pattern": "FLIPKART",
        "match_type": "KEYWORD",
        "party_id": 2,
        "category_id": 2,
        "priority": 2,
    },
    {
        "name": "Amazon Settlement Rule",
        "pattern": "AMAZON",
        "match_type": "KEYWORD",
        "party_id": 3,
        "category_id": 3,
        "priority": 3,
    },
    {
        "name": "BharatPe Payment Rule",
        "pattern": "BHARATPE",
        "match_type": "KEYWORD",
        "party_id": 4,
        "category_id": 4,
        "priority": 4,
    },
]

def seed_default_data(db: Session):
    # Seed Platforms if empty
    if db.query(Platform).count() == 0:
        for p in DEFAULT_PLATFORMS:
            db.add(Platform(
                id=p["id"],
                name=p["name"],
                code=p["code"],
                description=p["description"]
            ))
        db.commit()

    # Seed Categories if empty
    if db.query(Category).count() == 0:
        for cat in DEFAULT_CATEGORIES:
            db.add(Category(
                id=cat["id"],
                name=cat["name"],
                type=cat["type"],
                parent_id=cat["parent_id"],
                is_system=True,
                color=cat["color"]
            ))
        db.commit()

    # Seed Parties if empty
    if db.query(Party).count() == 0:
        for p in DEFAULT_PARTIES:
            db.add(Party(
                name=p["name"],
                category_id=p["category_id"],
                aliases=p["aliases"]
            ))
        db.commit()

    # Seed Rules if empty
    if db.query(CategorizationRule).count() == 0:
        for r in DEFAULT_RULES:
            db.add(CategorizationRule(
                name=r["name"],
                pattern=r["pattern"],
                match_type=r["match_type"],
                field="narration",
                party_id=r["party_id"],
                category_id=r["category_id"],
                priority=r["priority"],
                is_active=True
            ))
        db.commit()
