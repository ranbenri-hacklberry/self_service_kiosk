-- ============================================================
-- 📉 INVENTORY DEDUCTION LOGIC
-- ============================================================
-- This function handles the deduction of stock for a completed order.
-- It processes:
-- 1. Recipe Ingredients (e.g. Milk, Beans)
-- 2. Modifiers (e.g. +Soy Milk, +Syrup)
-- ============================================================

CREATE OR REPLACE FUNCTION deduct_inventory_for_order(p_order_id UUID, p_business_id UUID)
RETURNS VOID AS $$
DECLARE
    v_order_item RECORD;
    v_mod RECORD;
    v_ing RECORD;
    v_mod_json JSONB;
    v_qty_to_deduct NUMERIC;
    v_inv_unit TEXT;
BEGIN
    -- Loop through all items in the order
    FOR v_order_item IN 
        SELECT 
            oi.id, 
            oi.menu_item_id, 
            oi.quantity, 
            oi.mods,
            mi.name as item_name
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = p_order_id
          AND oi.item_status != 'cancelled' -- Don't deduct cancelled items
    LOOP
        
        -- ---------------------------------------------------------
        -- 1. DEDUCT RECIPE INGREDIENTS
        -- ---------------------------------------------------------
        FOR v_ing IN
            SELECT 
                ri.inventory_item_id, 
                ri.quantity_used
            FROM recipe_ingredients ri
            JOIN recipes r ON r.id = ri.recipe_id
            WHERE r.menu_item_id = v_order_item.menu_item_id
        LOOP
            -- Calculate total amount (Recipe Qty * Item Qty)
            v_qty_to_deduct := v_ing.quantity_used * v_order_item.quantity;

            -- Deduct from Inventory (Strict Business Check)
            -- FIX: Use GREATEST(0, ...) to prevent breaking the "no negative stock" constraint
            UPDATE inventory_items 
            SET current_stock = GREATEST(0, current_stock - v_qty_to_deduct)
            WHERE id = v_ing.inventory_item_id 
              AND business_id = p_business_id;
        END LOOP;

        -- ---------------------------------------------------------
        -- 2. DEDUCT MODIFIERS
        -- ---------------------------------------------------------
        -- Iterate over the JSONB mods array
        IF v_order_item.mods IS NOT NULL AND jsonb_array_length(v_order_item.mods) > 0 THEN
            FOR v_mod_json IN SELECT * FROM jsonb_array_elements(v_order_item.mods)
            LOOP
                -- Get the modifier details from database to be safe (and get inventory link)
                SELECT 
                    ov.inventory_item_id, 
                    ov.quantity as mod_qty, -- usually in grams
                    ov.is_replacement,
                    ii.unit as inv_unit
                INTO v_mod
                FROM optionvalues ov
                LEFT JOIN inventory_items ii ON ov.inventory_item_id = ii.id
                WHERE ov.id = (v_mod_json->>'id')::uuid;

                -- If modifier is linked to inventory
                IF v_mod.inventory_item_id IS NOT NULL THEN
                    
                    -- Unit Conversion Logic
                    -- If Inventory is in KG/Liters and Modifier is in Grams/ML -> Divide by 1000
                    -- We check common hebrew and english variations
                    IF v_mod.inv_unit IN ('kg', 'liter', 'litre', 'l', 'ml', 'קילו', 'ק״ג', 'ליטר', 'ק"ג') AND v_mod.mod_qty > 5 THEN 
                        -- Heuristic: If mod_qty > 5, it's likely grams. If it's 0.03, it's likely kg.
                        -- Common modifier qty is 30 (grams). Common stock unit is KG.
                        v_qty_to_deduct := (v_mod.mod_qty / 1000.0) * v_order_item.quantity;
                    ELSE
                        -- Assume matching units (Units, Cans, etc)
                        v_qty_to_deduct := v_mod.mod_qty * v_order_item.quantity;
                    END IF;

                    -- Deduct
                    -- FIX: Use GREATEST(0, ...) to prevent breaking the "no negative stock" constraint
                    UPDATE inventory_items 
                    SET current_stock = GREATEST(0, current_stock - v_qty_to_deduct)
                    WHERE id = v_mod.inventory_item_id 
                      AND business_id = p_business_id;
                      
                END IF;
            END LOOP;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT 'Deduction Function Created.' as status;
