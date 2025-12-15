-- ============================================================================
-- 🔧 תיקון אספרסו - גרסה פשוטה
-- ============================================================================
-- הרץ את השאילתות בסדר!
-- ============================================================================

-- שלב 1: מחיקת קבוצת "הפרדה" הריקה מאספרסו
-- ============================================================================
DELETE FROM menuitemoptions 
WHERE group_id = 'e556eeb9-f2cc-453d-89eb-9eaadf41a70a'
AND item_id IN (10, 11);

-- ✅ קבוצת "הפרדה" הוסרה מאספרסו
-- ============================================================================


-- שלב 2: יצירת קבוצה חדשה "תוספת חלב" + אפשרויות + הוספה לאספרסו
-- ============================================================================

-- 2.1: יצירת הקבוצה
DO $$
DECLARE
  new_group_id uuid;
BEGIN
  -- יצירת קבוצת מודיפיירים חדשה
  INSERT INTO optiongroups (name, is_required, is_multiple_select, display_order)
  VALUES ('תוספת חלב', false, false, 5)
  RETURNING id INTO new_group_id;
  
  -- הוספת אפשרויות לקבוצה
  INSERT INTO optionvalues (group_id, value_name, price_adjustment, display_order)
  VALUES 
    (new_group_id, 'ללא תוספת', 0, 1),
    (new_group_id, 'תוספת חלב רגיל', 0, 2),
    (new_group_id, 'תוספת חלב סויה', 0, 3),
    (new_group_id, 'תוספת חלב שיבולת', 0, 4);
  
  -- הוספת הקבוצה לאספרסו קצר וכפול
  INSERT INTO menuitemoptions (item_id, group_id)
  VALUES 
    (10, new_group_id),  -- אספרסו קצר
    (11, new_group_id);  -- אספרסו כפול
    
  RAISE NOTICE 'קבוצה חדשה נוצרה בהצלחה! ID: %', new_group_id;
END $$;

-- ✅ קבוצת "תוספת חלב" נוצרה והוספה לאספרסו
-- ============================================================================


-- שלב 3: אימות - בדוק שהכל עבד
-- ============================================================================
SELECT 
  mi.id,
  mi.name,
  og.name as group_name,
  COUNT(ov.id) as num_options,
  STRING_AGG(ov.value_name, ', ' ORDER BY ov.display_order) as options
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
LEFT JOIN optionvalues ov ON ov.group_id = og.id
WHERE mi.id IN (10, 11)
GROUP BY mi.id, mi.name, og.id, og.name, og.display_order
ORDER BY mi.id, og.display_order;

-- אמור להראות:
-- - אספרסו קצר: זמני חליטה, תוספת חלב, קפאין, אורך משקה
-- - אספרסו כפול: זמני חליטה, תוספת חלב, קפאין, אורך משקה
-- ============================================================================
