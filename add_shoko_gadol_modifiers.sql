-- Add "סוג חלב" modifiers to שוקו גדול (ID: 16)
-- Using the same group as שוקו קטן and שוקו פרלינים

-- First, remove any existing modifiers from שוקו גדול
DELETE FROM menuitemoptions WHERE item_id = 16;

-- Add the "סוג חלב" group to שוקו גדול
INSERT INTO menuitemoptions (item_id, group_id)
VALUES (16, '51d445c2-6dc4-4382-9eed-219eebacb460');  -- סוג חלב group

-- Verify: Check all three שוקו items now have only "סוג חלב"
SELECT 
    mi.id as item_id,
    mi.name as item_name,
    mi.price,
    og.name as group_name,
    COUNT(ov.id) as option_count
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
JOIN optionvalues ov ON og.id = ov.group_id
WHERE mi.id IN (15, 16, 17)
GROUP BY mi.id, mi.name, mi.price, og.name
ORDER BY mi.price, mi.name;
