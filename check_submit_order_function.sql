-- Check current submit_order function definition
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'submit_order'
AND routine_schema = 'public';
