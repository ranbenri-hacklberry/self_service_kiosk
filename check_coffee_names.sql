-- Check all coffee items in the system
SELECT 
    id,
    name,
    category,
    price
FROM menu_items
WHERE name ILIKE '%קפה%' 
   OR name ILIKE '%אספרסו%'
   OR name ILIKE '%שחור%'
   OR name ILIKE '%נס%'
ORDER BY name;
