-- בדיקת סוגי פריטים
SELECT 
    name,
    category,
    is_hot_drink,
    CASE 
        WHEN name LIKE '%טוסט%' OR name LIKE '%מרגריטה%' OR name LIKE '%סנדוויץ%' THEN 'מזון (לפי שם)'
        WHEN is_hot_drink = true THEN 'משקה חם'
        WHEN is_hot_drink = false THEN 'משקה קר'
        WHEN is_hot_drink IS NULL THEN 'NULL (כנראה מזון)'
        ELSE 'לא ברור'
    END as type_detected
FROM menu_items
WHERE name IN ('טוסט פשוט', 'טוסט פסטו', 'מרגריטה', 'שוקו גדול', 'הפוך קטן', 'אספרסו כפול')
ORDER BY type_detected, name;
