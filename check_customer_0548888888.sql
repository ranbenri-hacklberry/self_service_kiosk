-- Check loyalty data for customer 0548888888
SELECT 
    lc.customer_phone,
    lc.points_balance,
    lc.total_free_coffees_redeemed,
    lc.last_updated,
    (SELECT COUNT(*) FROM loyalty_transactions WHERE card_id = lc.id) as transaction_count
FROM loyalty_cards lc
WHERE lc.customer_phone = '0548888888';

-- Check recent transactions
SELECT 
    lt.transaction_type,
    lt.change_amount,
    lt.created_at,
    o.order_number
FROM loyalty_transactions lt
LEFT JOIN orders o ON lt.order_id = o.id
WHERE lt.card_id = (SELECT id FROM loyalty_cards WHERE customer_phone = '0548888888')
ORDER BY lt.created_at DESC
LIMIT 10;

-- Check customer record
SELECT * FROM customers WHERE phone = '0548888888';
