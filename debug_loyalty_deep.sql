-- Check RPC definitions
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('handle_loyalty_purchase', 'handle_loyalty_adjustment', 'get_loyalty_balance');

-- Check ALL loyalty cards for this phone (maybe duplicates?)
SELECT * FROM loyalty_cards WHERE customer_phone = '0548888888';

-- Check ALL customers with this phone
SELECT * FROM customers WHERE phone_number = '0548888888';

-- Check transactions to see where the 19 points came from
SELECT 
    lt.id,
    lt.transaction_type,
    lt.change_amount,
    lt.created_at,
    lc.customer_phone,
    lc.points_balance
FROM loyalty_transactions lt
JOIN loyalty_cards lc ON lt.card_id = lc.id
WHERE lc.customer_phone = '0548888888'
ORDER BY lt.created_at DESC;
