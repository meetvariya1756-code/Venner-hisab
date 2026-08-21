import sys
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add current directory to path so python can find the `app` package
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.models import (
    Platform,
    BankAccount,
    Statement,
    Category,
    Party,
    CategorizationRule,
    Transaction,
    AuditLog,
    User,
    UserSession,
    KhatabookEntry,
    UPIScreenshot
)

# 1. Database Connections
sqlite_url = f"sqlite:///accounting.db"
pg_url = settings.DATABASE_URL

if not pg_url.startswith("postgresql"):
    print("Error: DATABASE_URL in .env is not set to PostgreSQL.")
    print("Please set DATABASE_URL=postgresql://venner_user:venner_pass@localhost:5432/venner_hisab_dev in backend/.env")
    sys.exit(1)

print(f"Connecting to Source (SQLite): {sqlite_url}")
engine_sqlite = create_engine(sqlite_url)
SessionSqlite = sessionmaker(bind=engine_sqlite)
session_sqlite = SessionSqlite()

print(f"Connecting to Destination (PostgreSQL): {pg_url}")
engine_pg = create_engine(pg_url)
SessionPg = sessionmaker(bind=engine_pg)
session_pg = SessionPg()

# Ordered list of models to migrate (dependencies first)
models_to_migrate = [
    (Platform, "platforms"),
    (Category, "categories"),
    (BankAccount, "bank_accounts"),
    (Party, "parties"),
    (CategorizationRule, "rules"),
    (Statement, "statements"),
    (Transaction, "transactions"),
    (KhatabookEntry, "khatabook_entries"),
    (UPIScreenshot, "upi_screenshots"),
    (User, "users"),
    (UserSession, "user_sessions"),
    (AuditLog, "audit_logs")
]

try:
    print("\n--- Starting Data Migration ---")
    
    # Temporarily disable foreign key constraints or triggers if necessary in PG
    # (Since we are deleting and inserting in dependency order, this isn't strictly needed,
    # but we will do it in order to be clean)
    
    for model_class, table_name in models_to_migrate:
        # 1. Fetch data from SQLite
        sqlite_records = session_sqlite.query(model_class).all()
        print(f"Migrating table '{table_name}': Found {len(sqlite_records)} records in SQLite.")
        
        # 2. Clear destination table in PostgreSQL
        # We use raw SQL with CASCADE or delete to avoid foreign key violations,
        # but since we process in reverse dependency order, we can delete them.
        
    # We clear in reverse order of dependencies to avoid FK constraints violations
    print("\nClearing existing records in PostgreSQL...")
    for model_class, table_name in reversed(models_to_migrate):
        # Delete existing entries in PG
        session_pg.query(model_class).delete()
    session_pg.commit()
    print("PostgreSQL tables cleared successfully.")

    # Now copy data in forward order
    print("\nCopying records from SQLite to PostgreSQL...")
    for model_class, table_name in models_to_migrate:
        sqlite_records = session_sqlite.query(model_class).all()
        if not sqlite_records:
            continue
            
        columns = model_class.__table__.columns.keys()
        
        for rec in sqlite_records:
            # Create a new instance of the model class
            new_rec = model_class()
            for col in columns:
                val = getattr(rec, col)
                setattr(new_rec, col, val)
            session_pg.add(new_rec)
        
        session_pg.commit()
        print(f"  - Successfully copied {len(sqlite_records)} records into PostgreSQL table '{table_name}'.")

    # Update sequences in PostgreSQL
    print("\nResetting PostgreSQL ID sequences...")
    for model_class, table_name in models_to_migrate:
        # Check if the table has an auto-incrementing ID column
        if "id" in model_class.__table__.columns:
            seq_query = f"SELECT setval('{table_name}_id_seq', COALESCE((SELECT MAX(id) FROM {table_name}), 0) + 1, false);"
            try:
                session_pg.execute(text(seq_query))
                session_pg.commit()
                print(f"  - Reset sequence for '{table_name}'")
            except Exception as seq_err:
                session_pg.rollback()
                print(f"  - (Skip) Could not reset sequence for '{table_name}': {seq_err}")

    print("\nMigration completed successfully!")

except Exception as e:
    session_sqlite.rollback()
    session_pg.rollback()
    print(f"\nMigration failed: {e}")
    sys.exit(1)
finally:
    session_sqlite.close()
    session_pg.close()
