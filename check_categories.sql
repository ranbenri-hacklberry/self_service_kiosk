-- בדיקת קטגוריות של כל הפריטים
SELECT 
    name, 
    category, 
    is_hot_drink,
    CASE 
        WHEN category ILIKE '%drink%' OR category ILIKE '%משקה%' OR is_hot_drink IS NOT NULL THEN 'משקה'
        ELSE 'מזון'
    END as detected_type
FROM menu_items
WHERE is_prep_required = true
ORDER BY detected_type, name;
