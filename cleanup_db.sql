-- ============================================
-- DATABASE CLEANUP SCRIPT
-- iCaffe Self-Service Kiosk
-- Date: 2025-12-07
-- ============================================
-- IMPORTANT: Run this ONLY on production after backup!
-- Review each section before executing.
-- ============================================

BEGIN;

-- ============================================
-- SECTION 1: Add delivery_days to suppliers
-- (Before dropping supplier_delivery_schedule)
-- ============================================

-- First, check if column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'delivery_days'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN delivery_days TEXT;
        RAISE NOTICE 'Added delivery_days column to suppliers';
    ELSE
        RAISE NOTICE 'delivery_days column already exists in suppliers';
    END IF;
END $$;

-- Migrate data from supplier_delivery_schedule if exists
-- (You may need to adjust this based on actual structure)
-- UPDATE suppliers s SET delivery_days = (
--     SELECT string_agg(day_of_week, ',') 
--     FROM supplier_delivery_schedule sds 
--     WHERE sds.supplier_id = s.id
-- );

-- ============================================
-- SECTION 2: Add task_type to tasks
-- (For unifying kitchentasks)
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'task_type'
    ) THEN
        ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'general';
        RAISE NOTICE 'Added task_type column to tasks';
    ELSE
        RAISE NOTICE 'task_type column already exists in tasks';
    END IF;
END $$;

-- Migrate any data from kitchentasks to tasks (if needed)
-- INSERT INTO tasks (title, description, task_type, ...)
-- SELECT title, description, 'kitchen', ...
-- FROM kitchentasks;

-- ============================================
-- SECTION 3: Drop unused/merged tables
-- ============================================

-- Drop coffee_loyalty (replaced by loyalty_transactions)
DROP TABLE IF EXISTS coffee_loyalty CASCADE;
RAISE NOTICE 'Dropped coffee_loyalty table';

-- Drop invoices (empty, not in use)
DROP TABLE IF EXISTS invoices CASCADE;
RAISE NOTICE 'Dropped invoices table';

-- Drop kitchentasks (merged into tasks)
-- CAUTION: Only run after migrating data!
-- DROP TABLE IF EXISTS kitchentasks CASCADE;

-- Drop supplier_delivery_schedule (merged into suppliers)
-- CAUTION: Only run after migrating data!
-- DROP TABLE IF EXISTS supplier_delivery_schedule CASCADE;

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- Run these to verify the changes
-- ============================================

-- Check suppliers has new column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'suppliers';

-- Check tasks has new column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tasks';

-- List remaining tables
SELECT tablename, 
       (SELECT count(*) FROM information_schema.columns c WHERE c.table_name = t.tablename) as cols
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
