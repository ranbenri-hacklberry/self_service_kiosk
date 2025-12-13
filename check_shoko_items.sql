-- Check existing chocolate drinks
SELECT 
    id,
    name,
    category,
    price
FROM menu_items
WHERE name ILIKE '%שוקו%'
ORDER BY name;
