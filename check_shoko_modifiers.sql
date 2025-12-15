-- Check modifiers for שוקו קטן (ID: 15) and שוקו פרלינים (ID: 17)
SELECT 
    mi.id as item_id,
    mi.name as item_name,
    og.id as group_id,
    og.name as group_name,
    ov.id as value_id,
    ov.value_name,
    ov.price_adjustment
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
JOIN optionvalues ov ON og.id = ov.group_id
WHERE mi.id IN (15, 17)
ORDER BY mi.id, og.name, ov.value_name;
