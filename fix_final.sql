-- ============================================================================
-- תיקון סופי: נס על חלב, קפה שחור ומחיקת "הפרדה"
-- ============================================================================

-- 1. הסרת "הפרדה" מנס על חלב וקפה שחור
DELETE FROM menuitemoptions 
WHERE item_id IN (19, 20)
AND group_id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a';

-- ============================================================================

-- 2. בדיקה: האם נשארו פריטים שמשתמשים ב"הפרדה"?
SELECT 
  mi.name,
  og.name as group_name
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
WHERE og.id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a';

-- ============================================================================

-- 3. אם השאילתה למעלה החזירה 0 תוצאות - מחק את הקבוצה לגמרי!
-- (הסר את ההערה מהשורה הבאה כדי לבצע)

-- DELETE FROM optiongroups WHERE id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a';

-- ============================================================================

-- 4. סיכום סופי של כל המשקאות שטיפלנו בהם (10-20)
SELECT 
  mi.id,
  mi.name,
  COUNT(mio.group_id) as num_groups,
  STRING_AGG(og.name, ', ' ORDER BY og.display_order) as groups
FROM menu_items mi
LEFT JOIN menuitemoptions mio ON mi.id = mio.item_id
LEFT JOIN optiongroups og ON mio.group_id = og.id
WHERE mi.id BETWEEN 10 AND 20
GROUP BY mi.id, mi.name
ORDER BY mi.id;
