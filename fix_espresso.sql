-- ============================================================================
-- תיקון אספרסו - שלב 1: מחיקת קבוצת "הפרדה" הריקה
-- ============================================================================

-- בדיקה: איזה פריטים משתמשים בקבוצת "הפרדה"
SELECT 
  mi.id,
  mi.name,
  og.name as group_name
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
WHERE og.id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a'
ORDER BY mi.id;

-- ============================================================================

-- מחיקה: הסר את קבוצת "הפרדה" מכל הפריטים
DELETE FROM menuitemoptions 
WHERE group_id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a';

-- ============================================================================

-- מחיקה: הסר את קבוצת "הפרדה" עצמה (אופציונלי - אם רוצים למחוק לגמרי)
-- DELETE FROM optiongroups 
-- WHERE id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a';

-- ============================================================================
-- תיקון אספרסו - שלב 2: יצירת קבוצה חדשה "תוספת חלב קטנה"
-- ============================================================================

-- יצירת קבוצה חדשה
INSERT INTO optiongroups (name, is_required, is_multiple_select, display_order)
VALUES ('תוספת חלב', false, false, 10)
RETURNING id, name;

-- שים לב ל-ID שחוזר! תצטרך אותו בשלב הבא
-- לדוגמה: אם ה-ID שחזר הוא 'abc-123-def', השתמש בו למטה

-- ============================================================================
-- תיקון אספרסו - שלב 3: הוספת אפשרויות לקבוצה החדשה
-- ============================================================================

-- החלף את 'NEW_GROUP_ID_HERE' ב-ID שקיבלת בשלב 2!

-- INSERT INTO optionvalues (group_id, value_name, price_adjustment, display_order)
-- VALUES 
--   ('NEW_GROUP_ID_HERE', 'ללא תוספת', 0, 1),
--   ('NEW_GROUP_ID_HERE', 'תוספת חלב רגיל', 0, 2),
--   ('NEW_GROUP_ID_HERE', 'תוספת חלב סויה', 0, 3),
--   ('NEW_GROUP_ID_HERE', 'תוספת חלב שיבולת', 0, 4);

-- ============================================================================
-- תיקון אספרסו - שלב 4: הוספת הקבוצה החדשה לאספרסו
-- ============================================================================

-- החלף את 'NEW_GROUP_ID_HERE' ב-ID שקיבלת בשלב 2!

-- INSERT INTO menuitemoptions (item_id, group_id)
-- VALUES 
--   (10, 'NEW_GROUP_ID_HERE'),  -- אספרסו קצר
--   (11, 'NEW_GROUP_ID_HERE');  -- אספרסו כפול

-- ============================================================================
-- אימות: בדוק שהכל עבד
-- ============================================================================

-- SELECT 
--   mi.id,
--   mi.name,
--   og.name as group_name,
--   COUNT(ov.id) as num_options
-- FROM menu_items mi
-- JOIN menuitemoptions mio ON mi.id = mio.item_id
-- JOIN optiongroups og ON mio.group_id = og.id
-- LEFT JOIN optionvalues ov ON ov.group_id = og.id
-- WHERE mi.id IN (10, 11)
-- GROUP BY mi.id, mi.name, og.id, og.name
-- ORDER BY mi.id, og.display_order;
