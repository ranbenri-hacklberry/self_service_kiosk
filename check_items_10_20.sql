-- ============================================================================
-- בדיקת מודיפיירים לפריטים 10-20
-- ============================================================================

-- סקירה כללית של הפריטים
SELECT 
  mi.id,
  mi.name,
  mi.category,
  mi.price,
  mi.is_hot_drink,
  COUNT(DISTINCT mio.group_id) as num_modifier_groups
FROM menu_items mi
LEFT JOIN menuitemoptions mio ON mi.id = mio.item_id
WHERE mi.id BETWEEN 10 AND 20
GROUP BY mi.id, mi.name, mi.category, mi.price, mi.is_hot_drink
ORDER BY mi.id;

-- ============================================================================

-- פירוט מלא של כל פריט והמודיפיירים שלו
SELECT 
  mi.id as item_id,
  mi.name as item_name,
  mi.category,
  mi.price,
  og.id as group_id,
  og.name as modifier_group,
  og.display_order as group_order,
  COUNT(ov.id) as num_options_in_group
FROM menu_items mi
LEFT JOIN menuitemoptions mio ON mi.id = mio.item_id
LEFT JOIN optiongroups og ON mio.group_id = og.id
LEFT JOIN optionvalues ov ON ov.group_id = og.id
WHERE mi.id BETWEEN 10 AND 20
GROUP BY mi.id, mi.name, mi.category, mi.price, og.id, og.name, og.display_order
ORDER BY mi.id, og.display_order, og.name;

-- ============================================================================

-- פירוט מלא כולל כל האפשרויות בכל קבוצה
SELECT 
  mi.id as item_id,
  mi.name as item_name,
  mi.category,
  og.name as modifier_group,
  ov.value_name as option_name,
  ov.price_adjustment,
  ov.display_order
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
JOIN optionvalues ov ON ov.group_id = og.id
WHERE mi.id BETWEEN 10 AND 20
ORDER BY mi.id, og.display_order, og.name, ov.display_order, ov.value_name;
