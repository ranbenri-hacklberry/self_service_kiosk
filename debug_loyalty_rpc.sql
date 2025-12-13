-- Check if get_loyalty_balance RPC exists and its implementation
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'get_loyalty_balance';

-- Check loyalty_cards table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'loyalty_cards';

-- Check if there's a loyalty card for this phone
SELECT * FROM loyalty_cards WHERE customer_phone = '0548888888';

-- Check customers table
SELECT id, phone, name, loyalty_coffee_count FROM customers WHERE phone = '0548888888';
