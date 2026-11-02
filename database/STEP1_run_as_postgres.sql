-- STEP 1.1: Highlight this line and press F5 (or the Play button) to create the user:
-- (If it says "role already exists", you can ignore it!)
CREATE USER venner_user WITH PASSWORD 'venner_pass';

-- STEP 1.2: Highlight this line and press F5 (or the Play button) to create the database:
-- (If it says "database already exists", you can ignore it!)
CREATE DATABASE venner_hisab_dev OWNER venner_user;

-- STEP 1.3: Highlight this line and press F5 (or the Play button) to grant permissions:
GRANT ALL PRIVILEGES ON DATABASE venner_hisab_dev TO venner_user;