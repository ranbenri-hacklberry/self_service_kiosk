-- ============================================================================
-- 🍅 הוספת תוספות בתשלום לפריט 53
-- ============================================================================
-- הוספת 3 אפשרויות בתשלום: עגבניות, זיתים, בצל - כל אחת ב-4 ש"ח
-- ============================================================================

-- שלב 1: יצירת קבוצת אפשרויות חדשה "תוספות"
-- ============================================================================
DO $$
DECLARE
  new_group_id uuid;
BEGIN
  -- יצירת קבוצת מודיפיירים חדשה
  INSERT INTO optiongroups (name, is_required, is_multiple_select, display_order)
  VALUES ('תוספות', false, true, 10)  -- is_multiple_select = true כי אפשר לבחור כמה תוספות
  RETURNING id INTO new_group_id;
  
  -- הוספת 3 אפשרויות בתשלום (כל אחת ב-4 ש"ח)
  INSERT INTO optionvalues (group_id, value_name, price_adjustment, display_order)
  VALUES 
    (new_group_id, 'עגבניות', 4, 1),
    (new_group_id, 'זיתים', 4, 2),
    (new_group_id, 'בצל', 4, 3);
  
  -- הוספת הקבוצה לפריט 53
  INSERT INTO menuitemoptions (item_id, group_id)
  VALUES (53, new_group_id);
    
  RAISE NOTICE '✅ קבוצת תוספות נוצרה בהצלחה! ID: %', new_group_id;
  RAISE NOTICE '✅ 3 אפשרויות נוספו: עגבניות, זיתים, בצל (כל אחת ב-4 ש"ח)';
  RAISE NOTICE '✅ הקבוצה נוספה לפריט 53';
END $$;

-- ============================================================================
-- שלב 2: אימות - בדוק שהכל עבד
-- ============================================================================
SELECT 
  mi.id as item_id,
  mi.name as item_name,
  mi.price as base_price,
  og.name as group_name,
  og.is_multiple_select,
  ov.value_name,
  ov.price_adjustment,
  ov.display_order
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
LEFT JOIN optionvalues ov ON ov.group_id = og.id
WHERE mi.id = 53
ORDER BY og.display_order, ov.display_order;

-- אמור להראות:
-- - פריט 53 עם קבוצת "תוספות"
-- - 3 אפשרויות: עגבניות (4 ש"ח), זיתים (4 ש"ח), בצל (4 ש"ח)
-- ============================================================================

