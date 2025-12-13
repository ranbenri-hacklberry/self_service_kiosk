-- 1. הצגת כל העמודות בטבלת menu_items
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_items'
ORDER BY ordinal_position;

-- 2. בדיקה ספציפית של הסלטים והערך של kds_routing_logic
SELECT id, name, category, kds_routing_logic 
FROM menu_items 
WHERE name LIKE '%סלט%' OR category = 'סלטים';
