-- DEEP INSPECT PESTO (Item 8)
-- 1. Get the Recipe ID
SELECT id as recipe_id, menu_item_id FROM recipes WHERE menu_item_id = 8;

-- 2. Get the RAW ingredients (ID only)
SELECT * FROM recipe_ingredients 
WHERE recipe_id IN (SELECT id FROM recipes WHERE menu_item_id = 8);

-- 3. Try to JOIN with Inventory Items to see if they match
SELECT 
    ri.id as link_id,
    ri.inventory_item_id,
    ii.name as inventory_name,
    ii.id as found_inv_id,
    ri.quantity_used
FROM recipe_ingredients ri
LEFT JOIN inventory_items ii ON ri.inventory_item_id = ii.id
WHERE ri.recipe_id IN (SELECT id FROM recipes WHERE menu_item_id = 8);
