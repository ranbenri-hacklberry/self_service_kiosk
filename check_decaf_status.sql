-- בדיקת סטטוס "נטול קפאין" בבסיס הנתונים (מתוקן סופית לפי סכמה)

-- 1. בדיקה האם קבוצת "קפאין" והערכים שלה קיימים
SELECT 
    og.id as group_id,
    og.name as group_name, 
    ov.id as value_id,
    ov.value_name,
    ov.display_order
FROM optiongroups og
LEFT JOIN optionvalues ov ON ov.group_id = og.id
WHERE og.name LIKE '%קפאין%' OR ov.value_name LIKE '%נטול%';

-- 2. בדיקה לאילו פריטים הקבוצה הזו מקושרת
SELECT 
    mi.name as item_name,
    mi.category,
    og.name as linked_group_name
FROM menu_items mi
JOIN menuitemoptions mio ON mio.item_id = mi.id
JOIN optiongroups og ON og.id = mio.group_id
WHERE og.name LIKE '%קפאין%'
ORDER BY mi.category, mi.name;

-- 3. בדיקה של פריטים "חשודים" שצריכים את האופציה אבל אולי אין להם
SELECT 
    mi.name as item_should_have_decaf
FROM menu_items mi
WHERE (mi.category IN ('hot-drinks', 'שתיה חמה') OR mi.is_hot_drink = true)
AND NOT EXISTS (
    SELECT 1 
    FROM menuitemoptions mio
    JOIN optiongroups og ON og.id = mio.group_id
    WHERE mio.item_id = mi.id AND og.name LIKE '%קפאין%'
);
