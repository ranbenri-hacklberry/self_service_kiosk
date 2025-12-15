-- ============================================================================
-- 🧹 ניקוי מודיפיירים - גרסה פשוטה
-- ============================================================================
-- הוראות: הרץ את השאילתות בסדר הבא ב-Supabase SQL Editor
-- ============================================================================

-- שלב 1: בדיקה - מה יימחק?
-- ============================================================================
SELECT 
  mi.id,
  mi.name,
  mi.category,
  COUNT(DISTINCT mio.group_id) as num_modifiers,
  STRING_AGG(DISTINCT og.name, ', ') as modifier_names
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
WHERE mi.category IN ('מאפים', 'סלטים', 'סלט', 'כריכים וטוסטים', 'קינוחים', 'תוספות')
GROUP BY mi.id, mi.name, mi.category
ORDER BY mi.category, mi.name;

-- אם התוצאות נראות טוב, המשך לשלב 2
-- ============================================================================


-- שלב 2: מחיקה - הסר את המודיפיירים
-- ============================================================================
DELETE FROM menuitemoptions 
WHERE item_id IN (
  SELECT id FROM menu_items
  WHERE category IN ('מאפים', 'סלטים', 'סלט', 'כריכים וטוסטים', 'קינוחים', 'תוספות')
);

-- ✅ זהו! המודיפיירים נמחקו
-- ============================================================================


-- שלב 3 (אופציונלי): אימות - וודא שהכל נמחק
-- ============================================================================
SELECT 
  mi.name,
  mi.category,
  COUNT(mio.group_id) as remaining_modifiers
FROM menu_items mi
LEFT JOIN menuitemoptions mio ON mi.id = mio.item_id
WHERE mi.category IN ('מאפים', 'סלטים', 'קינוחים', 'תוספות')
GROUP BY mi.id, mi.name, mi.category
HAVING COUNT(mio.group_id) > 0;

-- אם השאילתה הזו לא מחזירה שום שורות - הצלחת! ✅
-- ============================================================================
