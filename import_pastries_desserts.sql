
-- Insert Pastries ('מאפים') and Desserts ('קינוחים') from menu_items into inventory_items
-- automatically linking them to Supplier 'Biscotti' (Finding ID by name)
-- EXCLUDING: 'מאפה בטטה', 'מאפה חצילים', 'מאפה חמאה', 'פפיון ריקוטה ותות'

WITH supplier_info AS (
    SELECT id FROM suppliers WHERE name = 'ביסקוטי' LIMIT 1
)
INSERT INTO inventory_items (name, category, current_stock, low_stock_alert, unit, supplier_id)
SELECT 
    m.name,
    'Bakery', -- Setting a category for these new items
    0, -- Initial stock
    5, -- Default low stock alert (was min_stock)
    'יח׳', -- Unit
    (SELECT id FROM supplier_info) -- Supplier ID (Biscotti)
FROM menu_items m
WHERE 
    m.category IN ('מאפים', 'קינוחים')
    AND m.name NOT IN ('מאפה בטטה', 'מאפה חצילים', 'מאפה חמאה', 'פפיון ריקוטה ותות')
    AND NOT EXISTS (
        SELECT 1 FROM inventory_items i WHERE i.name = m.name
    );

-- Optional: Link the new inventory items to the menu items via recipes logic (Direct 1:1)

-- 1. Create recipes for these items if they don't exist
INSERT INTO recipes (menu_item_id, instructions, preparation_quantity, quantity_unit)
SELECT 
    m.id, 
    'Take from inventory', 
    1, 
    'unit'
FROM menu_items m
WHERE 
    m.category IN ('מאפים', 'קינוחים')
    AND m.name NOT IN ('מאפה בטטה', 'מאפה חצילים', 'מאפה חמאה', 'פפיון ריקוטה ותות')
    AND NOT EXISTS (SELECT 1 FROM recipes r WHERE r.menu_item_id = m.id);

-- 2. Link the Recipe to the Inventory Item (auto-created above)
INSERT INTO recipe_ingredients (recipe_id, inventory_item_id, quantity_used, unit_of_measure)
SELECT 
    r.id, 
    i.id, 
    1, 
    'unit'
FROM recipes r
JOIN menu_items m ON r.menu_item_id = m.id
JOIN inventory_items i ON i.name = m.name
WHERE 
    m.category IN ('מאפים', 'קינוחים')
    AND m.name NOT IN ('מאפה בטטה', 'מאפה חצילים', 'מאפה חמאה', 'פפיון ריקוטה ותות')
    AND NOT EXISTS (
        SELECT 1 FROM recipe_ingredients ri WHERE ri.recipe_id = r.id
    );
