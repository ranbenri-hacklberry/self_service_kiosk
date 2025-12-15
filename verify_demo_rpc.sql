SELECT 
    n.nspname as schema_name,
    p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname = 'submit_order_v2'
AND n.nspname = 'demo';
