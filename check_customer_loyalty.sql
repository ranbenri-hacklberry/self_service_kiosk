-- Check specific customer loyalty
SELECT 
    c.name,
    c.phone,
    c.loyalty_coffee_count
FROM customers c
WHERE c.phone = '05488888888';

-- Check last orders for this customer to see what happened
SELECT 
    o.order_number,
    o.created_at,
    oi.quantity,
    mi.name,
    mi.is_hot_drink
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE o.customer_phone = '05488888888'
ORDER BY o.created_at DESC
LIMIT 10;
