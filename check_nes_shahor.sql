-- בדיקת נס על חלב וקפה שחור
SELECT 
  mi.id,
  mi.name,
  og.name as group_name,
  og.display_order,
  COUNT(ov.id) as num_options,
  STRING_AGG(ov.value_name, ', ' ORDER BY ov.display_order) as options
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
LEFT JOIN optionvalues ov ON ov.group_id = og.id
WHERE mi.id IN (19, 20)
GROUP BY mi.id, mi.name, og.id, og.name, og.display_order
ORDER BY mi.id, og.display_order;
