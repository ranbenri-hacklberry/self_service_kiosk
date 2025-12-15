-- Check if notes column exists and has data
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'order_items' 
AND column_name = 'notes';

-- Check recent orders with notes
SELECT 
    o.order_number,
    o.created_at,
    oi.notes,
    mi.name as item_name
FROM orders o
JOIN order_items oi ON o.id = oi.order_id  
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE o.created_at > NOW() - INTERVAL '1 hour'
ORDER BY o.created_at DESC
LIMIT 10;
