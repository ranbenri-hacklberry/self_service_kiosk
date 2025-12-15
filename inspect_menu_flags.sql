-- INSPECT MENU ITEM FLAGS
-- 1. Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_items'
AND column_name IN ('is_hot_drink', 'is_hidden', 'category');

-- 2. Check the data (omitting is_hidden if it doesn't exist)
SELECT id, name, category, is_hot_drink 
FROM menu_items 
ORDER BY category, name;
