-- Simple check for notes
SELECT 
    o.order_number,
    to_char(o.created_at AT TIME ZONE 'Asia/Jerusalem', 'HH24:MI:SS') as israel_time,
    mi.name as item_name,
    oi.notes
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
ORDER BY o.created_at DESC
LIMIT 5;
