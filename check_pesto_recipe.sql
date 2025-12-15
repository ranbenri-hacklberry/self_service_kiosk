-- CHECK RECIPE & INVENTORY DATA (TOAST PESTO - ID 8)
-- 1. Check if Item 8 exists
SELECT id, name, CAST(category AS TEXT) as category FROM menu_items WHERE id = 8;

-- 2. Check Recipes for Item 8
SELECT * FROM recipes WHERE menu_item_id = 8;

-- 3. Check Ingredients
SELECT 
    ri.id, 
    ri.inventory_item_id, 
    ii.name as inventory_name, 
    ri.quantity_used, 
    ri.cost_per_unit
FROM recipe_ingredients ri
JOIN inventory_items ii ON ri.inventory_item_id = ii.id
WHERE ri.recipe_id IN (SELECT id FROM recipes WHERE menu_item_id = 8);

-- 4. Check Business ID of Inventory Items
-- This is key: If business_id is NULL or different, RLS might hide them.
SELECT id, name, business_id FROM inventory_items LIMIT 5;
