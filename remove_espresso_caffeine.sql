-- ============================================================================
-- הסרת קבוצת "קפאין" מאספרסו קצר וכפול
-- ============================================================================

-- בדיקה: מה יוסר
SELECT 
  mi.id,
  mi.name,
  og.name as group_name
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
WHERE mi.id IN (10, 11)
AND og.id = '11bf86be-3814-4a98-ac13-602dc3bc8789';

-- ============================================================================

-- מחיקה: הסר את קבוצת "קפאין" מאספרסו
DELETE FROM menuitemoptions 
WHERE item_id IN (10, 11)
AND group_id = '11bf86be-3814-4a98-ac13-602dc3bc8789';

-- ✅ קבוצת "קפאין" הוסרה מאספרסו
-- ============================================================================

-- אימות: בדוק מה נשאר
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
WHERE mi.id IN (10, 11)
GROUP BY mi.id, mi.name, og.id, og.name, og.display_order
ORDER BY mi.id, og.display_order;

-- אמור להראות רק:
-- - זמני חליטה
-- - תוספת חלב
-- - אורך משקה
-- ============================================================================
