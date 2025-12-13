SELECT 
    o.id as order_id, 
    o.order_number, 
    o.total_amount, 
    o.is_paid,
    COUNT(oi.id) as item_count,
    json_agg(json_build_object('name', mi.name, 'status', oi.item_status, 'qty', oi.quantity, 'id', oi.id)) as items
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
ORDER BY o.created_at DESC
LIMIT 1;
