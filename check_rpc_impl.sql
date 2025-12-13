-- Check handle_loyalty_purchase implementation
SELECT routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_loyalty_purchase';
