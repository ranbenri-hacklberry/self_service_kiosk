-- CHECK RECENT LOYALTY ACTIVITY
SELECT 
    lt.id,
    lt.created_at,
    lt.points_earned,
    lt.points_redeemed,
    lc.customer_phone,
    lc.points_balance as card_balance,
    c.loyalty_coffee_count as customer_balance,
    c.phone_number
FROM loyalty_transactions lt
JOIN loyalty_cards lc ON lt.card_id = lc.id
JOIN customers c ON lc.customer_phone = c.phone_number
ORDER BY lt.created_at DESC
LIMIT 5;
