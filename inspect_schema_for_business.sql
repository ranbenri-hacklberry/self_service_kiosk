-- ============================================================
-- AUDIT: Check Multi-Tenancy Structure
-- ============================================================

-- 1. Check 'businesses' table definition
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'businesses'
ORDER BY ordinal_position;

-- 2. Check for 'business_id' column in ALL tables
SELECT table_name, column_name
FROM information_schema.columns 
WHERE column_name = 'business_id' 
  AND table_schema = 'public'
ORDER BY table_name;

-- 3. Check sample data in 'businesses'
SELECT * FROM businesses LIMIT 5;

-- 4. Check if RLS is enabled on key tables
SELECT relname as table_name, relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN ('orders', 'inventory_items', 'menu_items', 'businesses', 'employees');

-- 5. Check sample 'inventory_items' to see if 'business_id' is actually populated
SELECT id, name, business_id 
FROM inventory_items 
LIMIT 10;
