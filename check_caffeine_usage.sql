-- בדיקה: איזה משקאות משתמשים בקבוצת "קפאין"
SELECT 
  mi.id,
  mi.name,
  mi.category,
  og.name as group_name
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
WHERE og.id = '11bf86be-3814-4a98-ac13-602dc3bc8789'
ORDER BY mi.id;
