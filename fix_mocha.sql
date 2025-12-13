-- ============================================================================
-- הוספת מודיפיירים למוקה (ID: 18)
-- ============================================================================
-- מוקה = הפוך + שוקולית, אז צריך את אותם מודיפיירים כמו הפוך
-- ============================================================================

-- בדיקה: מה יש למוקה עכשיו
SELECT 
  mi.id,
  mi.name,
  COUNT(mio.group_id) as num_groups
FROM menu_items mi
LEFT JOIN menuitemoptions mio ON mi.id = mio.item_id
WHERE mi.id = 18
GROUP BY mi.id, mi.name;

-- ============================================================================

-- הוספה: העתק את כל הקבוצות מהפוך קטן למוקה
-- (ללא קבוצת "הפרדה" הריקה)
INSERT INTO menuitemoptions (item_id, group_id)
SELECT 
  18 as item_id,  -- מוקה
  mio.group_id
FROM menuitemoptions mio
WHERE mio.item_id = 12  -- הפוך קטן
AND mio.group_id != 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a'  -- לא "הפרדה"
ON CONFLICT DO NOTHING;  -- אם כבר קיים, אל תוסיף שוב

-- ✅ מודיפיירים הועתקו למוקה
-- ============================================================================

-- אימות: בדוק מה יש למוקה עכשיו
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
WHERE mi.id = 18
GROUP BY mi.id, mi.name, og.id, og.name, og.display_order
ORDER BY og.display_order;

-- אמור להראות 6 קבוצות:
-- 1. סוג חלב (רגיל, סויה, שיבולת, שקדים)
-- 2. טמפרטורה (רגיל, רותח, פושר)
-- 3. בסיס משקה (חלב רגיל, על בסיס מים, חצי חלב חצי מים)
-- 4. קצף (רגיל, הרבה קצף, מעט קצף, בלי קצף)
-- 5. קפאין (רגיל, נטול קפאין)
-- 6. הגשה (רגיל, מפורק)
-- ============================================================================
