-- CHECK BROKEN RECIPES
-- The user says ingredients are missing/wrong.
-- 1. Check if there are ANY ingredients for Pesto (8)
SELECT * FROM recipes WHERE menu_item_id = 8;
SELECT * FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE menu_item_id = 8);

-- 2. Check if we have inventory items with 'Pesto', 'Cheese', 'Bread'
SELECT id, name, business_id FROM inventory_items 
WHERE name LIKE '%לחם%' OR name LIKE '%פסטו%' OR name LIKE '%גבינה%';

-- 3. Hypothesis: The inventory items might have been deleted/recreated with new IDs, 
-- leaving the recipe_ingredients pointing to nothing (or deleted by CASCADE).
-- Let's check if there are orphan recipe_ingredients?
-- (Usually CASCADE handles this, meaning if item deleted, recipe ingredient deleted).
