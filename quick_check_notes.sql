-- Quick check: Show last 5 orders with their notes (Israel local time)
SELECT 
    o.order_number,
    (o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem')::timestamp(0) as local_time,
    mi.name as item_name,
    oi.notes,
    CASE 
        WHEN oi.notes IS NULL THEN '❌ NULL'
        WHEN oi.notes = '' THEN '⚠️ Empty String'
        ELSE '✅ Has Note'
    END as note_status
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
ORDER BY o.created_at DESC
LIMIT 5;
