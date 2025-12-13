-- Check modifiers for שוקו גדול (ID: 16)
SELECT 
    mi.id as item_id,
    mi.name as item_name,
    og.id as group_id,
    og.name as group_name,
    ov.value_name,
    ov.price_adjustment
FROM menu_items mi
LEFT JOIN menuitemoptions mio ON mi.id = mio.item_id
LEFT JOIN optiongroups og ON mio.group_id = og.id
LEFT JOIN optionvalues ov ON og.id = ov.group_id
WHERE mi.id = 16
ORDER BY og.name, ov.value_name;
