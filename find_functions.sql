-- ============================================
-- STEP 1: Find all versions of submit_order_v2
-- Run this first to see all function signatures
-- ============================================

SELECT 
    n.nspname as schema,
    p.proname as function_name,
    pg_get_function_identity_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'submit_order_v2';
