-- ============================================================================
-- הסרת "חזק" ו"חלש" מקבוצת הקפאין
-- ============================================================================

-- בדיקה: מה יוסר
SELECT 
  og.name as group_name,
  ov.id as value_id,
  ov.value_name,
  ov.price_adjustment
FROM optiongroups og
JOIN optionvalues ov ON og.id = ov.group_id
WHERE og.id = '11bf86be-3814-4a98-ac13-602dc3bc8789'
AND ov.value_name IN ('חזק', 'חלש');

-- ============================================================================

-- מחיקה: הסר את "חזק" ו"חלש" מקבוצת הקפאין
DELETE FROM optionvalues 
WHERE group_id = '11bf86be-3814-4a98-ac13-602dc3bc8789'
AND value_name IN ('חזק', 'חלש');

-- ✅ "חזק" ו"חלש" הוסרו מקבוצת הקפאין
-- ============================================================================

-- אימות: בדוק מה נשאר בקבוצת הקפאין
SELECT 
  og.name as group_name,
  ov.value_name,
  ov.price_adjustment,
  ov.display_order
FROM optiongroups og
JOIN optionvalues ov ON og.id = ov.group_id
WHERE og.id = '11bf86be-3814-4a98-ac13-602dc3bc8789'
ORDER BY ov.display_order;

-- אמור להראות רק:
-- - רגיל
-- - נטול קפאין
-- ============================================================================

-- אימות נוסף: בדוק את אספרסו עם הקבוצה המעודכנת
SELECT 
  mi.id,
  mi.name,
  og.name as group_name,
  STRING_AGG(ov.value_name, ', ' ORDER BY ov.display_order) as options
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
LEFT JOIN optionvalues ov ON ov.group_id = og.id
WHERE mi.id IN (10, 11)
AND og.id = '11bf86be-3814-4a98-ac13-602dc3bc8789'
GROUP BY mi.id, mi.name, og.id, og.name
ORDER BY mi.id;

-- אמור להראות:
-- אספרסו קצר - קפאין: רגיל, נטול קפאין
-- אספרסו כפול - קפאין: רגיל, נטול קפאין
-- ============================================================================
