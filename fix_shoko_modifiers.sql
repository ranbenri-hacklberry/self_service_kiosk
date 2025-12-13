-- Remove all modifiers except "סוג חלב" from all three שוקו items
-- שוקו קטן (15), שוקו גדול (16), שוקו פרלינים (17)

-- Delete the associations (menuitemoptions) for unwanted groups
DELETE FROM menuitemoptions
WHERE item_id IN (15, 16, 17)
AND group_id IN (
    '80aaecac-c071-44e2-aec4-eb7cd5b9c0dc',  -- בסיס משקה
    'e1b65ea0-6261-4c41-b8c6-17b999b89d7f',  -- טמפרטורה
    'c9d1294e-4af2-486a-9cde-07f1aef3aaab'   -- קצף
);

-- Verify: Check remaining modifiers (should only be "סוג חלב")
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
