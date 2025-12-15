-- Check both loyalty locations for customer 0548888888
-- (Fixed version - checking actual column names)

-- First, let's see the customer record
SELECT * FROM customers WHERE customer_phone = '0548888888' OR phone_number = '0548888888';

-- Check loyalty_cards table
SELECT 
    customer_phone,
    points_balance,
    total_free_coffees_redeemed,
    last_updated
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
