-- ════════════════════════════════════════════════════════════════
-- Venner-Hisab — Complete Master PostgreSQL Setup & Migration Script
-- ════════════════════════════════════════════════════════════════
-- Run this single file in pgAdmin 4 or psql to set up or update
-- your local or production PostgreSQL database with all latest tables.
-- Run it while connected to the venner_hisab_dev database.
-- STEP1_run_as_postgres.sql is only for one-time role/database creation.
-- ════════════════════════════════════════════════════════════════

-- ── 1. Create Application Tables ────────────────────────────────

-- 1. Platforms
CREATE TABLE IF NOT EXISTS public.platforms (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(50),
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bank / Store Accounts
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id               SERIAL PRIMARY KEY,
    platform_id      INTEGER REFERENCES public.platforms(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    account_holder   VARCHAR(150),
    bank_name        VARCHAR(100) NOT NULL,
    account_number   VARCHAR(100) NOT NULL,
    account_type     VARCHAR(50)  NOT NULL DEFAULT 'Savings',
    opening_balance  NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency         VARCHAR(10)  NOT NULL DEFAULT 'INR',
    access_code      VARCHAR(50)  UNIQUE,
    phone_number     VARCHAR(30),
    pdf_password     VARCHAR(100),
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 3. Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    type      VARCHAR(20)  NOT NULL CHECK (type IN ('INCOME','EXPENSE')),
    parent_id INTEGER      REFERENCES public.categories(id) ON DELETE SET NULL,
    is_system BOOLEAN      NOT NULL DEFAULT FALSE,
    color     VARCHAR(20)  NOT NULL DEFAULT '#6366f1'
);

-- 4. Parties
CREATE TABLE IF NOT EXISTS public.parties (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    aliases     TEXT         NOT NULL DEFAULT '[]',
    category_id INTEGER      REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 5. Categorization Rules
CREATE TABLE IF NOT EXISTS public.rules (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    pattern     VARCHAR(255) NOT NULL,
    match_type  VARCHAR(20)  NOT NULL DEFAULT 'KEYWORD'
                    CHECK (match_type IN ('KEYWORD','EXACT','REGEX','CONTAINS','STARTS_WITH')),
    field       VARCHAR(50)  NOT NULL DEFAULT 'narration',
    party_id    INTEGER      REFERENCES public.parties(id) ON DELETE SET NULL,
    category_id INTEGER      REFERENCES public.categories(id) ON DELETE SET NULL,
    priority    INTEGER      NOT NULL DEFAULT 10,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 6. Statements
CREATE TABLE IF NOT EXISTS public.statements (
    id                  SERIAL PRIMARY KEY,
    account_id          INTEGER       NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    filename            VARCHAR(255)  NOT NULL,
    file_hash           VARCHAR(64)   NOT NULL,
    year_month          VARCHAR(7)    NOT NULL,
    start_date          VARCHAR(20),
    end_date            VARCHAR(20),
    opening_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    closing_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_credits       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_debits        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    transaction_count   INTEGER       NOT NULL DEFAULT 0,
    status              VARCHAR(20)   NOT NULL DEFAULT 'imported'
                            CHECK (status IN ('imported','pending_review')),
    uploaded_via_mobile BOOLEAN       NOT NULL DEFAULT FALSE,
    original_file_path  VARCHAR(500),
    uploader_name       VARCHAR(150),
    uploaded_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 7. Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
    id              SERIAL PRIMARY KEY,
    statement_id    INTEGER       NOT NULL REFERENCES public.statements(id) ON DELETE CASCADE,
    account_id      INTEGER       NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    date            VARCHAR(20)   NOT NULL,
    narration       VARCHAR(500)  NOT NULL,
    ref_no          VARCHAR(100),
    debit           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    credit          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    balance         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    page_number     INTEGER       NOT NULL DEFAULT 1,
    party_id        INTEGER       REFERENCES public.parties(id) ON DELETE SET NULL,
    category_id     INTEGER       REFERENCES public.categories(id) ON DELETE SET NULL,
    is_categorized  BOOLEAN       NOT NULL DEFAULT FALSE,
    review_status   VARCHAR(20)   NOT NULL DEFAULT 'uncategorized'
                        CHECK (review_status IN ('uncategorized','auto_matched','manually_reviewed')),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id              SERIAL PRIMARY KEY,
    transaction_id  INTEGER      NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    action          VARCHAR(50)  NOT NULL,
    old_values      TEXT,
    new_values      TEXT,
    user_info       VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 9. Users
CREATE TABLE IF NOT EXISTS public.users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(20)  NOT NULL DEFAULT 'owner'
                   CHECK (role IN ('owner','manager')),
    full_name  VARCHAR(150),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 10. User Sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token        VARCHAR(128) NOT NULL UNIQUE,
    device_id    VARCHAR(128),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ  NOT NULL,
    last_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ip_address   VARCHAR(45),
    user_agent   VARCHAR(512),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE
);

-- 11. Khatabook Entries
CREATE TABLE IF NOT EXISTS public.khatabook_entries (
    id                  SERIAL PRIMARY KEY,
    account_id          INTEGER       NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    entry_type          VARCHAR(10)   NOT NULL CHECK (entry_type IN ('GAVE','GOT')),
    amount              NUMERIC(15,2) NOT NULL,
    description         TEXT,
    entry_date          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    bill_image_path     VARCHAR(500),
    created_by_user_id  INTEGER,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 12. UPI Screenshots (Complete with latest columns)
CREATE TABLE IF NOT EXISTS public.upi_screenshots (
    id                SERIAL PRIMARY KEY,
    account_id        INTEGER      NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
    target_account_id INTEGER      REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
    filename          VARCHAR(255) NOT NULL,
    file_path         VARCHAR(500) NOT NULL,
    amount            DOUBLE PRECISION,
    entry_type        VARCHAR(20),
    description       VARCHAR(500),
    uploaded_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── 2. Safe Column Migrations (For Existing Databases) ─────────
ALTER TABLE public.upi_screenshots ADD COLUMN IF NOT EXISTS target_account_id INTEGER REFERENCES public.bank_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.upi_screenshots ADD COLUMN IF NOT EXISTS amount DOUBLE PRECISION;
ALTER TABLE public.upi_screenshots ADD COLUMN IF NOT EXISTS entry_type VARCHAR(20);
ALTER TABLE public.upi_screenshots ADD COLUMN IF NOT EXISTS description VARCHAR(500);

ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS access_code VARCHAR(50) UNIQUE;
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30);
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS pdf_password VARCHAR(100);

-- ── 3. Performance Indexes ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS ix_statements_account_month ON public.statements(account_id, year_month);
CREATE INDEX IF NOT EXISTS ix_statements_file_hash ON public.statements(file_hash);
CREATE INDEX IF NOT EXISTS ix_transactions_account_id   ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS ix_transactions_statement_id ON public.transactions(statement_id);
CREATE INDEX IF NOT EXISTS ix_transactions_category_id  ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS ix_transactions_party_id     ON public.transactions(party_id);
CREATE INDEX IF NOT EXISTS ix_transactions_date         ON public.transactions(date);
CREATE INDEX IF NOT EXISTS ix_user_sessions_token ON public.user_sessions(token);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_active ON public.user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS ix_khatabook_entries_account ON public.khatabook_entries(account_id);
CREATE INDEX IF NOT EXISTS ix_upi_screenshots_account ON public.upi_screenshots(account_id);

-- ── 4. Seed Default Platforms & Categories ─────────────────────
INSERT INTO public.platforms (id, name, code, description) VALUES
    (1, 'Meesho',                'MEESHO',   'Meesho Marketplace Seller Accounts'),
    (2, 'Flipkart',              'FLIPKART', 'Flipkart Marketplace Seller Accounts'),
    (3, 'Amazon',                'AMAZON',   'Amazon Seller Central Accounts'),
    (4, 'Direct Party / Vendors','OTHER',    'Direct Party Payments & Vendor Accounts')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.categories (id, name, type, parent_id, is_system, color) VALUES
    (1,  'Marketplace Sales - Meesho',   'INCOME',  NULL, TRUE, '#ec4899'),
    (2,  'Marketplace Sales - Flipkart', 'INCOME',  NULL, TRUE, '#2563eb'),
    (3,  'Marketplace Sales - Amazon',   'INCOME',  NULL, TRUE, '#f59e0b'),
    (4,  'Marketplace Sales - Other',    'INCOME',  NULL, TRUE, '#10b981'),
    (5,  'Other Income',                 'INCOME',  NULL, TRUE, '#06b6d4'),
    (6,  'Vendor Payments',              'EXPENSE', NULL, TRUE, '#ef4444'),
    (7,  'Rent',                         'EXPENSE', NULL, TRUE, '#8b5cf6'),
    (8,  'Salaries',                     'EXPENSE', NULL, TRUE, '#6366f1'),
    (9,  'Fees & Bank Charges',          'EXPENSE', NULL, TRUE, '#f97316'),
    (10, 'Other Expense',                'EXPENSE', NULL, TRUE, '#64748b')
ON CONFLICT DO NOTHING;

INSERT INTO public.rules (name, pattern, match_type, field, party_id, category_id, priority)
SELECT r.name, r.pattern, 'KEYWORD', 'narration', p.id, r.cat_id, r.prio
FROM (VALUES
    ('Meesho Settlement Rule',   'MEESHO',   'Meesho',   1, 1),
    ('Flipkart Settlement Rule', 'FLIPKART', 'Flipkart', 2, 2),
    ('Amazon Settlement Rule',   'AMAZON',   'Amazon',   3, 3),
    ('BharatPe Payment Rule',    'BHARATPE', 'BharatPe', 4, 4)
) AS r(name, pattern, party_name, cat_id, prio)
ON CONFLICT DO NOTHING;

-- Default Users (Change passwords before going to production!)
INSERT INTO users (username, password, role, full_name) VALUES
    ('Venner Enterprise', 'Venner@Enterprise', 'owner',   'Venner Enterprise Owner'),
    ('owner',             'owner123',          'owner',   'System Owner'),
    ('manager',           'manager123',        'manager', 'Khatabook Store Manager')
ON CONFLICT (username) DO NOTHING;


-- ════════════════════════════════════════════════════════════════
-- SECTION F — Role Permissions
-- ════════════════════════════════════════════════════════════════

GRANT ALL ON ALL TABLES    IN SCHEMA public TO venner_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO venner_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO venner_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO venner_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO venner_user;


-- ════════════════════════════════════════════════════════════════
-- SECTION G — Quick Verification
-- ════════════════════════════════════════════════════════════════

SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
