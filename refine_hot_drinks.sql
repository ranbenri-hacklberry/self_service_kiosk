
-- Fix false positives: Unmark food items from being "hot drinks"
UPDATE menu_items 
SET is_hot_drink = false
WHERE category IN ('קינוחים', 'מאפים', 'כריכים', 'Desserts', 'Pastries', 'Sandwiches')
   OR category LIKE '%אוכל%';

-- Verify clean list
SELECT id, name, category, is_hot_drink FROM menu_items WHERE is_hot_drink = true;
