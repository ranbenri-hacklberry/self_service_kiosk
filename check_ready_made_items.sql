-- Check which items are marked as ready-made (don't require preparation)
SELECT 
    id,
    name,
    category,
    price,
    is_ready_made
FROM menu_items
WHERE is_ready_made = true
ORDER BY category, name;

-- Count of ready-made vs requires-preparation items
SELECT 
    is_ready_made,
    COUNT(*) as item_count
FROM menu_items
GROUP BY is_ready_made;
