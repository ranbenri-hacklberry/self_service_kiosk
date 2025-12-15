-- Check both loyalty locations for customer 0548888888

-- OLD SYSTEM: customers table
SELECT 
    phone,
    name,
    loyalty_coffee_count as old_system_count
FROM customers 
WHERE phone = '0548888888';

-- NEW SYSTEM: loyalty_cards table
SELECT 
    customer_phone,
    points_balance as new_system_balance,
    total_free_coffees_redeemed
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
LIMIT 5;
