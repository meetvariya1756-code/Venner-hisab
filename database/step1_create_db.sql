-- ════════════════════════════════════════════════════════════════
-- SECTION A ONLY — Run this as PostgreSQL superuser (postgres)
-- Use: pg_ctl, pgAdmin, or Windows auth (run as Administrator)
--
-- If you've lost the postgres password, reset it:
-- 1. Open Services → stop "postgresql-x64-16"
-- 2. Edit pg_hba.conf → change all "md5" to "trust"
-- 3. Start service → run this file as postgres user
-- 4. Run: ALTER USER postgres WITH PASSWORD 'newpassword123';
-- 5. Restore pg_hba.conf and restart
-- ════════════════════════════════════════════════════════════════

-- Create the app user (change password as needed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'venner_user') THEN
        CREATE USER venner_user WITH PASSWORD 'venner_pass';
    END IF;
END
$$;

-- Create the database
SELECT 'CREATE DATABASE venner_hisab_dev OWNER venner_user ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'venner_hisab_dev')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE venner_hisab_dev TO venner_user;

-- Verify
\echo '✅ Database and user created. Now connect to venner_hisab_dev and run venner_hisab_setup.sql'
\l venner_hisab_dev
