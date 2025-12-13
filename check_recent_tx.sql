-- Check recent transactions to understand the calculation
SELECT 
    lt.transaction_type,
    lt.change_amount,
    lt.created_at,
    lc.points_balance as current_balance
FROM loyalty_transactions lt
JOIN loyalty_cards lc ON lt.card_id = lc.id
WHERE lc.customer_phone = '0548888888'
ORDER BY lt.created_at DESC
LIMIT 5;
