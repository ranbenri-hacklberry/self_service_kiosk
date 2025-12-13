-- בדיקת כל קבוצות המודיפיירים והאפשרויות שלהם
SELECT 
  og.id as group_id,
  og.name as group_name,
  og.display_order,
  ov.id as value_id,
  ov.value_name,
  ov.price_adjustment,
  ov.display_order as value_order
FROM optiongroups og
LEFT JOIN optionvalues ov ON og.id = ov.group_id
ORDER BY og.name, ov.display_order, ov.value_name;

-- ============================================================================

-- בדיקה ספציפית של קבוצות החלב
SELECT 
  og.id as group_id,
  og.name as group_name,
  ov.id as value_id,
  ov.value_name,
  ov.price_adjustment
FROM optiongroups og
JOIN optionvalues ov ON og.id = ov.group_id
WHERE og.name LIKE '%חלב%'
ORDER BY og.name, ov.value_name;

-- ============================================================================

-- בדיקה של אספרסו קצר וכפול - מה יש להם עכשיו
SELECT 
  mi.id,
  mi.name,
  og.id as group_id,
  og.name as group_name,
  COUNT(ov.id) as num_options
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
LEFT JOIN optionvalues ov ON ov.group_id = og.id
WHERE mi.id IN (10, 11)
GROUP BY mi.id, mi.name, og.id, og.name
ORDER BY mi.id, og.display_order;
