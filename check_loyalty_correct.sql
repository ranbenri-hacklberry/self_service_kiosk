-- Check both loyalty systems with CORRECT column names
-- customers table uses: phone_number, loyalty_coffee_count
-- loyalty_cards table uses: customer_phone, points_balance

-- OLD SYSTEM: customers table
SELECT 
    phone_number,
    name,
    loyalty_coffee_count as old_system_count,
    'OLD SYSTEM' as source
FROM customers 
WHERE phone_number = '0548888888';

-- NEW SYSTEM: loyalty_cards table  
SELECT 
    customer_phone as phone_number,
    NULL as name,
    points_balance as old_system_count,
    'NEW SYSTEM' as source
FROM loyalty_cards 
WHERE customer_phone = '0548888888';

-- Check recent loyalty transactions
SELECT 
    lt.transaction_type,
    lt.change_amount,
    lt.created_at,
    o.order_number
FROM loyalty_transactions lt
LEFT JOIN loyalty_cards lc ON lt.card_id = lc.id
LEFT JOIN orders o ON lt.order_id = o.id
WHERE lc.customer_phone = '0548888888'
ORDER BY lt.created_at DESC
LIMIT 10;
