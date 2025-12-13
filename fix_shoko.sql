-- ============================================================================
-- תיקון שוקו - הסרת "קפאין" ו"הפרדה"
-- ============================================================================
-- שוקו לא מכיל קפאין משמעותי, אז אין צורך באפשרות הזו
-- ============================================================================

-- בדיקה: מה יוסר
SELECT 
  mi.id,
  mi.name,
  og.name as group_name
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
WHERE mi.id IN (15, 16, 17)  -- שוקו קטן, גדול, פרלינים
AND og.id IN (
  '11bf86be-3814-4a98-ac13-602dc3bc8789',  -- קפאין
  'e556eeb9-f2cc-453d-89eb-9eaadf41a70a'   -- הפרדה
)
ORDER BY mi.id, og.name;

-- ============================================================================

-- מחיקה: הסר "קפאין" ו"הפרדה" מכל סוגי השוקו
DELETE FROM menuitemoptions 
WHERE item_id IN (15, 16, 17)  -- שוקו קטן, גדול, פרלינים
AND group_id IN (
  '11bf86be-3814-4a98-ac13-602dc3bc8789',  -- קפאין
  'e556eeb9-f2cc-453d-89eb-9eaadf41a70a'   -- הפרדה
);

-- ✅ "קפאין" ו"הפרדה" הוסרו מהשוקו
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
WHERE mi.id IN (15, 16, 17)
GROUP BY mi.id, mi.name, og.id, og.name, og.display_order
ORDER BY mi.id, og.display_order;

-- אמור להראות 4 קבוצות לכל שוקו:
-- 1. סוג חלב (רגיל, סויה, שיבולת, שקדים)
-- 2. טמפרטורה (רגיל, רותח, פושר)
-- 3. בסיס משקה (חלב רגיל, על בסיס מים, חצי חלב חצי מים)
-- 4. קצף (רגיל, הרבה קצף, מעט קצף, בלי קצף)
-- ============================================================================
