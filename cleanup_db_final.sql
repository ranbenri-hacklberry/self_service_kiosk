-- ============================================
-- DATABASE CLEANUP SCRIPT - FINAL
-- iCaffe Self-Service Kiosk
-- Date: 2025-12-07
-- ============================================
-- BACKUP FIRST! Then run in Supabase SQL Editor
-- ============================================

BEGIN;

-- ============================================
-- STEP 1: Add delivery_days to suppliers
-- ============================================

ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS delivery_days TEXT;

COMMENT ON COLUMN suppliers.delivery_days IS 'ימי אספקה, למשל: ראשון,רביעי';

-- ============================================
-- STEP 2: Drop unused tables
-- ============================================

-- Drop coffee_loyalty (replaced by loyalty_transactions)
DROP TABLE IF EXISTS coffee_loyalty CASCADE;

-- Drop invoices (empty, not in use)
DROP TABLE IF EXISTS invoices CASCADE;

-- Drop kitchentasks (empty, tasks table is used instead)
DROP TABLE IF EXISTS kitchentasks CASCADE;

-- Drop supplier_delivery_schedule (merged into suppliers.delivery_days)
DROP TABLE IF EXISTS supplier_delivery_schedule CASCADE;

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify suppliers has new column
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'suppliers'
ORDER BY ordinal_position;

-- Verify tables are dropped
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('coffee_loyalty', 'invoices', 'kitchentasks', 'supplier_delivery_schedule');

-- Should return empty result if all dropped successfully
