-- ════════════════════════════════════════════════════════════════
-- Venner-Hisab — Complete PostgreSQL Database Migration & Setup
-- 
-- Compatible with PostgreSQL 14, 15, 16+
--
-- STEP 1: Connect as superuser (postgres) and run SECTION A to create DB & user.
-- STEP 2: Connect to `venner_hisab_dev` (or production DB) and run SECTIONS B–G.
-- ════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════
-- SECTION A — Database & User Setup
-- Run as: postgres superuser (postgres)
-- ════════════════════════════════════════════════════════════════

-- Create the application user (change password before production)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'venner_user') THEN
        CREATE USER venner_user WITH PASSWORD 'venner_pass';
    END IF;
END
$$;

-- Create the application database
SELECT 'CREATE DATABASE venner_hisab_dev OWNER venner_user ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'venner_hisab_dev')\gexec

-- Grant all privileges on the database
GRANT ALL PRIVILEGES ON DATABASE venner_hisab_dev TO venner_user;

-- ┌─────────────────────────────────────────────────────────────┐
-- │ Now connect to venner_hisab_dev and run SECTIONS B-G below │
-- │  pgAdmin: right-click venner_hisab_dev → Query Tool         │
-- │  psql   : \c venner_hisab_dev                               │
-- └─────────────────────────────────────────────────────────────┘


-- ════════════════════════════════════════════════════════════════
-- SECTION B — Application Tables
-- Defines all 12 core application tables with full integrity.
-- ════════════════════════════════════════════════════════════════

-- 1. Platforms
CREATE TABLE IF NOT EXISTS platforms (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    code        VARCHAR(50),
    description VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Bank Accounts
CREATE TABLE IF NOT EXISTS bank_accounts (
    id               SERIAL PRIMARY KEY,
    platform_id      INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
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

-- 3. Categories (self-referencing parent/child hierarchy)
CREATE TABLE IF NOT EXISTS categories (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    type      VARCHAR(20)  NOT NULL CHECK (type IN ('INCOME','EXPENSE')),
    parent_id INTEGER      REFERENCES categories(id) ON DELETE SET NULL,
    is_system BOOLEAN      NOT NULL DEFAULT FALSE,
    color     VARCHAR(20)  NOT NULL DEFAULT '#6366f1'
);

-- 4. Parties (payees / vendors)
CREATE TABLE IF NOT EXISTS parties (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL UNIQUE,
    aliases     TEXT         NOT NULL DEFAULT '[]',
    category_id INTEGER      REFERENCES categories(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 5. Categorization Rules
CREATE TABLE IF NOT EXISTS rules (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    pattern     VARCHAR(255) NOT NULL,
    match_type  VARCHAR(20)  NOT NULL DEFAULT 'KEYWORD'
                    CHECK (match_type IN ('KEYWORD','EXACT','REGEX','CONTAINS','STARTS_WITH')),
    field       VARCHAR(50)  NOT NULL DEFAULT 'narration',
    party_id    INTEGER      REFERENCES parties(id) ON DELETE SET NULL,
    category_id INTEGER      REFERENCES categories(id) ON DELETE SET NULL,
    priority    INTEGER      NOT NULL DEFAULT 10,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 6. Statements (uploaded bank statement PDFs)
CREATE TABLE IF NOT EXISTS statements (
    id                  SERIAL PRIMARY KEY,
    account_id          INTEGER      NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    filename            VARCHAR(255) NOT NULL,
    file_hash           VARCHAR(64)  NOT NULL,
    year_month          VARCHAR(7)   NOT NULL,
    start_date          VARCHAR(20),
    end_date            VARCHAR(20),
    opening_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    closing_balance     NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_credits       NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    total_debits        NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    transaction_count   INTEGER      NOT NULL DEFAULT 0,
    status              VARCHAR(20)  NOT NULL DEFAULT 'imported'
                            CHECK (status IN ('imported','pending_review')),
    uploaded_via_mobile BOOLEAN      NOT NULL DEFAULT FALSE,
    original_file_path  VARCHAR(500),
    uploader_name       VARCHAR(150),
    uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 7. Transactions
CREATE TABLE IF NOT EXISTS transactions (
    id              SERIAL PRIMARY KEY,
    statement_id    INTEGER      NOT NULL REFERENCES statements(id) ON DELETE CASCADE,
    account_id      INTEGER      NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    date            VARCHAR(20)  NOT NULL,
    narration       VARCHAR(500) NOT NULL,
    ref_no          VARCHAR(100),
    debit           NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    credit          NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    balance         NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    page_number     INTEGER      NOT NULL DEFAULT 1,
    party_id        INTEGER      REFERENCES parties(id) ON DELETE SET NULL,
    category_id     INTEGER      REFERENCES categories(id) ON DELETE SET NULL,
    is_categorized  BOOLEAN      NOT NULL DEFAULT FALSE,
    review_status   VARCHAR(20)  NOT NULL DEFAULT 'uncategorized'
                        CHECK (review_status IN ('uncategorized','auto_matched','manually_reviewed')),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 8. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id              SERIAL PRIMARY KEY,
    transaction_id  INTEGER      NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    action          VARCHAR(50)  NOT NULL,
    old_values      TEXT,
    new_values      TEXT,
    user_info       VARCHAR(100) NOT NULL DEFAULT 'system',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 9. Users
CREATE TABLE IF NOT EXISTS users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(20)  NOT NULL DEFAULT 'owner'
                   CHECK (role IN ('owner','manager')),
    full_name  VARCHAR(150),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 10. User Sessions (server-side session management with device fingerprinting)
CREATE TABLE IF NOT EXISTS user_sessions (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS khatabook_entries (
    id                  SERIAL PRIMARY KEY,
    account_id          INTEGER       NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    entry_type          VARCHAR(10)   NOT NULL CHECK (entry_type IN ('GAVE','GOT')),
    amount              NUMERIC(15,2) NOT NULL,
    description         TEXT,
    entry_date          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    bill_image_path     VARCHAR(500),
    created_by_user_id  INTEGER,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- 12. UPI Screenshots
CREATE TABLE IF NOT EXISTS upi_screenshots (
    id          SERIAL PRIMARY KEY,
    account_id  INTEGER      NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
    filename    VARCHAR(255) NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    uploaded_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ════════════════════════════════════════════════════════════════
-- SECTION C — Performance & Integrity Indexes
-- ════════════════════════════════════════════════════════════════

-- Statement lookups & duplicate detection
CREATE INDEX IF NOT EXISTS ix_statements_account_month ON statements(account_id, year_month);
CREATE INDEX IF NOT EXISTS ix_statements_file_hash ON statements(file_hash);

-- Transaction lookups
CREATE INDEX IF NOT EXISTS ix_transactions_account_id   ON transactions(account_id);
CREATE INDEX IF NOT EXISTS ix_transactions_statement_id ON transactions(statement_id);
CREATE INDEX IF NOT EXISTS ix_transactions_category_id  ON transactions(category_id);
CREATE INDEX IF NOT EXISTS ix_transactions_party_id     ON transactions(party_id);
CREATE INDEX IF NOT EXISTS ix_transactions_date         ON transactions(date);

-- Session management indexes
CREATE INDEX IF NOT EXISTS ix_user_sessions_token ON user_sessions(token);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_active ON user_sessions(user_id, is_active);
CREATE INDEX IF NOT EXISTS ix_user_sessions_device ON user_sessions(user_id, device_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS ix_user_sessions_expires ON user_sessions(expires_at);

-- Khatabook lookups
CREATE INDEX IF NOT EXISTS ix_khatabook_entries_account ON khatabook_entries(account_id);
CREATE INDEX IF NOT EXISTS ix_khatabook_entries_date ON khatabook_entries(entry_date);

-- Categorization rules by priority
CREATE INDEX IF NOT EXISTS ix_rules_active_priority ON rules(priority ASC) WHERE is_active = TRUE;


-- ════════════════════════════════════════════════════════════════
-- SECTION D — Session Management Stored Procedures
-- ════════════════════════════════════════════════════════════════

-- D1. Create user session (deactivates previous active sessions for user)
CREATE OR REPLACE FUNCTION create_user_session(
    p_user_id      INTEGER,
    p_token        VARCHAR(128),
    p_device_id    VARCHAR(128) DEFAULT NULL,
    p_ttl_seconds  INTEGER      DEFAULT 28800,  -- 8 hours
    p_ip_address   VARCHAR(45)  DEFAULT NULL,
    p_user_agent   VARCHAR(512) DEFAULT NULL
)
RETURNS TABLE (
    session_id   INTEGER,
    token        VARCHAR(128),
    expires_at   TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
DECLARE
    v_expires_at TIMESTAMPTZ := NOW() + (p_ttl_seconds || ' seconds')::INTERVAL;
    v_id         INTEGER;
BEGIN
    -- Deactivate any previous active session for this user
    UPDATE user_sessions
    SET is_active = FALSE
    WHERE user_id = p_user_id AND is_active = TRUE;

    -- Insert new session
    INSERT INTO user_sessions (user_id, token, device_id, expires_at, ip_address, user_agent, is_active)
    VALUES (p_user_id, p_token, COALESCE(p_device_id, 'default_device'), v_expires_at, p_ip_address, p_user_agent, TRUE)
    RETURNING id INTO v_id;

    RETURN QUERY SELECT v_id, p_token, v_expires_at;
END;
$$;


-- D2. Validate a session token
DROP FUNCTION IF EXISTS validate_user_session(varchar);
CREATE OR REPLACE FUNCTION validate_user_session(p_token VARCHAR(128))
RETURNS TABLE (
    out_user_id    INTEGER,
    out_username   VARCHAR(100),
    out_role       VARCHAR(20),
    out_full_name  VARCHAR(150),
    out_expires_at TIMESTAMPTZ,
    out_is_valid   BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Touch last_seen_at for valid sessions
    UPDATE user_sessions
    SET last_seen_at = NOW()
    WHERE token = p_token AND is_active = TRUE AND expires_at > NOW();

    -- Return user info if valid
    RETURN QUERY
    SELECT
        u.id::INTEGER,
        u.username::VARCHAR(100),
        u.role::VARCHAR(20),
        u.full_name::VARCHAR(150),
        s.expires_at,
        TRUE::BOOLEAN
    FROM user_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token     = p_token
      AND s.is_active = TRUE
      AND s.expires_at > NOW();
END;
$$;


-- D3. Logout — invalidate session
CREATE OR REPLACE FUNCTION logout_user_session(p_token VARCHAR(128))
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE user_sessions
    SET is_active = FALSE
    WHERE token = p_token;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count > 0;
END;
$$;


-- D4. Cleanup expired sessions (> 24h old or inactive)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions
    WHERE expires_at < NOW() - INTERVAL '24 hours' OR is_active = FALSE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


-- D5. Force logout all sessions for a user
CREATE OR REPLACE FUNCTION logout_all_user_sessions(p_user_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    UPDATE user_sessions
    SET is_active = FALSE
    WHERE user_id = p_user_id AND is_active = TRUE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;


-- ════════════════════════════════════════════════════════════════
-- SECTION E — Default Seed Data (Idempotent)
-- ════════════════════════════════════════════════════════════════

-- Platforms
INSERT INTO platforms (id, name, code, description) VALUES
    (1, 'Meesho',                'MEESHO',   'Meesho Marketplace Seller Accounts'),
    (2, 'Flipkart',              'FLIPKART', 'Flipkart Marketplace Seller Accounts'),
    (3, 'Amazon',                'AMAZON',   'Amazon Seller Central Accounts'),
    (4, 'Direct Party / Vendors','OTHER',    'Direct Party Payments & Vendor Accounts')
ON CONFLICT (name) DO NOTHING;
SELECT setval('platforms_id_seq', GREATEST((SELECT MAX(id) FROM platforms), 1));

-- Categories
INSERT INTO categories (id, name, type, parent_id, is_system, color) VALUES
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
SELECT setval('categories_id_seq', GREATEST((SELECT MAX(id) FROM categories), 1));

-- Parties
INSERT INTO parties (name, category_id, aliases) VALUES
    ('Meesho',   1, '["MEESHO TECHNOLOGIES","MEESHO","MEESHOPAY","MEESHO PAYMEN","MESHO SETTLE"]'),
    ('Flipkart', 2, '["FLIPKART","FKMP","INSTAKART"]'),
    ('Amazon',   3, '["AMAZON","ATVP","AMZN"]'),
    ('BharatPe', 4, '["BHARATPE","PAY TO BHARATPE"]')
ON CONFLICT (name) DO NOTHING;

-- Rules
INSERT INTO rules (name, pattern, match_type, field, party_id, category_id, priority, is_active)
SELECT r.name, r.pattern, 'KEYWORD', 'narration', p.id, r.cat_id, r.prio, TRUE
FROM (VALUES
    ('Meesho Settlement Rule',   'MEESHO',   'Meesho',   1, 1),
    ('Flipkart Settlement Rule', 'FLIPKART', 'Flipkart', 2, 2),
    ('Amazon Settlement Rule',   'AMAZON',   'Amazon',   3, 3),
    ('BharatPe Payment Rule',    'BHARATPE', 'BharatPe', 4, 4)
) AS r(name, pattern, party_name, cat_id, prio)
JOIN parties p ON p.name = r.party_name
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
