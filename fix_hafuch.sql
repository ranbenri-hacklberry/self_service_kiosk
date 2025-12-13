-- ============================================================================
-- תיקון הפוך קטן וגדול - הסרת קבוצת "הפרדה" הריקה
-- ============================================================================

-- בדיקה: מה יוסר
SELECT 
  mi.id,
  mi.name,
  og.name as group_name
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
WHERE mi.id IN (12, 13)
AND og.id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a';

-- ============================================================================

-- מחיקה: הסר את קבוצת "הפרדה" מהפוך קטן וגדול
DELETE FROM menuitemoptions 
WHERE item_id IN (12, 13)
AND group_id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a';

-- ✅ קבוצת "הפרדה" הוסרה מהפוך
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
WHERE mi.id IN (12, 13)
GROUP BY mi.id, mi.name, og.id, og.name, og.display_order
ORDER BY mi.id, og.display_order;

-- אמור להראות 6 קבוצות:
-- 1. סוג חלב
-- 2. טמפרטורה
-- 3. בסיס משקה
-- 4. קצף
-- 5. קפאין
-- 6. הגשה
-- ============================================================================
