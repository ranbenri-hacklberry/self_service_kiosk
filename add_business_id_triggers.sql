-- ============================================================
-- ⚡️ AUTO-ASSIGN BUSINESS_ID TRIGGER
-- ============================================================
-- Ensures that any record inserted without a business_id
-- automatically gets one from the current user's context.
-- ============================================================

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION set_business_id_automatically()
RETURNS TRIGGER AS $$
BEGIN
    -- Only set if NULL
    IF NEW.business_id IS NULL THEN
        NEW.business_id := current_user_business_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Apply Trigger to All Multi-Tenant Tables
-- using DO block to avoid errors if trigger exists

DO $$
BEGIN
    -- Menu Items
    DROP TRIGGER IF EXISTS trigger_set_business_id_menu_items ON menu_items;
    CREATE TRIGGER trigger_set_business_id_menu_items
    BEFORE INSERT ON menu_items
    FOR EACH ROW EXECUTE FUNCTION set_business_id_automatically();

    -- Inventory Items
    DROP TRIGGER IF EXISTS trigger_set_business_id_inventory_items ON inventory_items;
    CREATE TRIGGER trigger_set_business_id_inventory_items
    BEFORE INSERT ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION set_business_id_automatically();

    -- Orders (Even though SP handles it, good for direct inserts)
    DROP TRIGGER IF EXISTS trigger_set_business_id_orders ON orders;
    CREATE TRIGGER trigger_set_business_id_orders
    BEFORE INSERT ON orders
    FOR EACH ROW EXECUTE FUNCTION set_business_id_automatically();

    -- Recipes
    DROP TRIGGER IF EXISTS trigger_set_business_id_recipes ON recipes;
    CREATE TRIGGER trigger_set_business_id_recipes
    BEFORE INSERT ON recipes
    FOR EACH ROW EXECUTE FUNCTION set_business_id_automatically();

    -- Option Groups
    DROP TRIGGER IF EXISTS trigger_set_business_id_optiongroups ON optiongroups;
    CREATE TRIGGER trigger_set_business_id_optiongroups
    BEFORE INSERT ON optiongroups
    FOR EACH ROW EXECUTE FUNCTION set_business_id_automatically();

    -- Option Values
    DROP TRIGGER IF EXISTS trigger_set_business_id_optionvalues ON optionvalues;
    CREATE TRIGGER trigger_set_business_id_optionvalues
    BEFORE INSERT ON optionvalues
    FOR EACH ROW EXECUTE FUNCTION set_business_id_automatically();
    
    -- Suppliers
    DROP TRIGGER IF EXISTS trigger_set_business_id_suppliers ON suppliers;
    CREATE TRIGGER trigger_set_business_id_suppliers
    BEFORE INSERT ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_business_id_automatically();

END $$;

SELECT 'Triggers applied: INSERT operations will now auto-assign business_id.' as status;
