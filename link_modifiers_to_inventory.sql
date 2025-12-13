-- ============================================================
-- סקריפט לחיבור תוספות (optionvalues) לפריטי מלאי (inventory_items)
-- ============================================================

-- שלב 1: הצגת כל התוספות והמלאי לבדיקה (לא משנה כלום)
SELECT 
    ov.id as option_id,
    ov.value_name as option_name,
    ov.inventory_item_id as current_link,
    ii.id as matching_inventory_id,
    ii.name as inventory_name
FROM optionvalues ov
LEFT JOIN inventory_items ii ON LOWER(TRIM(ov.value_name)) = LOWER(TRIM(ii.name))
ORDER BY ov.value_name;

-- ============================================================
-- שלב 2: עדכון אוטומטי של חיבורים לפי שם זהה
-- ============================================================

-- חיבור אוטומטי לפי שם זהה (exact match)
UPDATE optionvalues ov
SET inventory_item_id = ii.id
FROM inventory_items ii
WHERE LOWER(TRIM(ov.value_name)) = LOWER(TRIM(ii.name))
  AND ov.inventory_item_id IS NULL;

-- ============================================================
-- שלב 3: חיבורים ידניים נפוצים (התאם לפי הנתונים שלך)
-- ============================================================

-- דוגמאות - עדכן את זה לפי השמות האמיתיים במערכת שלך:

-- חלב סויה
UPDATE optionvalues 
SET inventory_item_id = (SELECT id FROM inventory_items WHERE name ILIKE '%סויה%' LIMIT 1)
WHERE value_name ILIKE '%סויה%' AND inventory_item_id IS NULL;

-- חלב שיבולת שועל
UPDATE optionvalues 
SET inventory_item_id = (SELECT id FROM inventory_items WHERE name ILIKE '%שיבולת%' OR name ILIKE '%שועל%' LIMIT 1)
WHERE (value_name ILIKE '%שיבולת%' OR value_name ILIKE '%שועל%') AND inventory_item_id IS NULL;

-- חלב שקדים
UPDATE optionvalues 
SET inventory_item_id = (SELECT id FROM inventory_items WHERE name ILIKE '%שקד%' LIMIT 1)
WHERE value_name ILIKE '%שקד%' AND inventory_item_id IS NULL;

-- חלב קוקוס
UPDATE optionvalues 
SET inventory_item_id = (SELECT id FROM inventory_items WHERE name ILIKE '%קוקוס%' LIMIT 1)
WHERE value_name ILIKE '%קוקוס%' AND inventory_item_id IS NULL;

-- סירופ וניל
UPDATE optionvalues 
SET inventory_item_id = (SELECT id FROM inventory_items WHERE name ILIKE '%וניל%' LIMIT 1)
WHERE value_name ILIKE '%וניל%' AND inventory_item_id IS NULL;

-- סירופ קרמל
UPDATE optionvalues 
SET inventory_item_id = (SELECT id FROM inventory_items WHERE name ILIKE '%קרמל%' LIMIT 1)
WHERE value_name ILIKE '%קרמל%' AND inventory_item_id IS NULL;

-- סירופ אגוז
UPDATE optionvalues 
SET inventory_item_id = (SELECT id FROM inventory_items WHERE name ILIKE '%אגוז%' OR name ILIKE '%לוז%' LIMIT 1)
WHERE (value_name ILIKE '%אגוז%' OR value_name ILIKE '%לוז%') AND inventory_item_id IS NULL;

-- ============================================================
-- שלב 4: הגדרת משקל ברירת מחדל לתוספות שחוברו
-- (30 גרם = כמות טיפוסית לתוספת חלב/סירופ)
-- ============================================================

UPDATE optionvalues 
SET quantity = 30 
WHERE inventory_item_id IS NOT NULL 
  AND (quantity IS NULL OR quantity = 0);

-- ============================================================
-- שלב 5: בדיקה סופית - הצגת המצב אחרי העדכון
-- ============================================================

SELECT 
    ov.id,
    ov.value_name as "שם התוספת",
    ii.name as "פריט מלאי מחובר",
    ov.quantity as "משקל (גרם)",
    ii.price as "מחיר לק״ג",
    CASE 
        WHEN ii.id IS NOT NULL AND ov.quantity > 0 
        THEN ROUND((ov.quantity / 1000.0) * COALESCE(ii.price, 0), 2)
        ELSE NULL 
    END as "עלות תוספת"
FROM optionvalues ov
LEFT JOIN inventory_items ii ON ov.inventory_item_id = ii.id
ORDER BY ii.name IS NULL, ov.value_name;
