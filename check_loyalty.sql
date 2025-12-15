-- Check last customer loyalty status
SELECT 
    c.name,
    c.phone,
    c.loyalty_coffee_count,
    o.created_at as last_order_time,
    o.order_number
FROM customers c
JOIN orders o ON o.customer_phone = c.phone
ORDER BY o.created_at DESC
LIMIT 1;
