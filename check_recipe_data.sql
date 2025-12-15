-- CHECK RECIPE & INVENTORY DATA
-- Focusing on Menu Item ID 9 (Toast Alfredo) as a sample

-- 1. Check Inventory Items
SELECT count(*) as inventory_count FROM inventory_items;

-- 2. Check Recipes for Item 9
SELECT * FROM recipes WHERE menu_item_id = 9;

-- 3. Check Ingredients for those recipes
SELECT * FROM recipe_ingredients 
WHERE recipe_id IN (SELECT id FROM recipes WHERE menu_item_id = 9);

-- 4. Check RLS Policies (Catalog)
SELECT tablename, policyname, cmd, roles, qual 
FROM pg_policies 
WHERE tablename IN ('inventory_items', 'recipes', 'recipe_ingredients');
