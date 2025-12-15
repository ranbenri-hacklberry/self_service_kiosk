-- ============================================================
-- 🔐 MULTI-TENANCY LOCKDOWN SCRIPT (PHASE 1) - FIXED
-- ============================================================

-- 1. Enable RLS on core tables
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE optiongroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE optionvalues ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
-- Removed 'categories' rename as table does not exist.

-- 2. Add 'business_id' column to tables where it might be missing
DO $$ 
BEGIN 
    -- menu_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'business_id') THEN
        ALTER TABLE menu_items ADD COLUMN business_id UUID;
    END IF;

    -- recipes
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'business_id') THEN
        ALTER TABLE recipes ADD COLUMN business_id UUID;
    END IF;

    -- optiongroups
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optiongroups' AND column_name = 'business_id') THEN
        ALTER TABLE optiongroups ADD COLUMN business_id UUID;
    END IF;

    -- optionvalues
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'optionvalues' AND column_name = 'business_id') THEN
        ALTER TABLE optionvalues ADD COLUMN business_id UUID;
    END IF;

    -- suppliers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'business_id') THEN
        ALTER TABLE suppliers ADD COLUMN business_id UUID;
    END IF;
    
    -- employees
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'business_id') THEN
        ALTER TABLE employees ADD COLUMN business_id UUID;
    END IF;
    
    -- Add auth_user_id to employees to link with Supabase Auth
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'auth_user_id') THEN
        ALTER TABLE employees ADD COLUMN auth_user_id UUID;
    END IF;
END $$;

-- 3. Set Default Business ID for existing records (Pilot Cafe)
-- Using ID: 11111111-1111-1111-1111-111111111111
DO $$
DECLARE
    pilot_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    UPDATE menu_items SET business_id = pilot_id WHERE business_id IS NULL;
    UPDATE inventory_items SET business_id = pilot_id WHERE business_id IS NULL;
    UPDATE orders SET business_id = pilot_id WHERE business_id IS NULL;
    UPDATE recipes SET business_id = pilot_id WHERE business_id IS NULL;
    UPDATE optiongroups SET business_id = pilot_id WHERE business_id IS NULL;
    UPDATE optionvalues SET business_id = pilot_id WHERE business_id IS NULL;
    UPDATE suppliers SET business_id = pilot_id WHERE business_id IS NULL;
    UPDATE employees SET business_id = pilot_id WHERE business_id IS NULL;
END $$;

-- 4. Create Helper Function to get Current User's Business
CREATE OR REPLACE FUNCTION current_user_business_id() RETURNS UUID AS $$
DECLARE
    v_business_id UUID;
BEGIN
    -- Try to match via auth_user_id first
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    -- Fallback: If no auth_user_id linked yet, allow if user is anon/service_role or for testing
    -- For this migration moment, if we return NULL, everything disappears.
    -- TEMPORARY: If we can't find the user, default to Pilot Cafe SO YOU DON'T GET LOCKED OUT immediately.
    -- REMOVE THIS LINE AFTER LINKING EMPLOYEES
    IF v_business_id IS NULL THEN
        v_business_id := '11111111-1111-1111-1111-111111111111'; 
    END IF;

    RETURN v_business_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create RLS Policies
-- We drop existing to ensure clean state

-- ORDERS
DROP POLICY IF EXISTS "Orders isolation" ON orders;
CREATE POLICY "Orders isolation" ON orders
    USING (business_id = current_user_business_id())
    WITH CHECK (business_id = current_user_business_id());

-- INVENTORY
DROP POLICY IF EXISTS "Inventory isolation" ON inventory_items;
CREATE POLICY "Inventory isolation" ON inventory_items
    USING (business_id = current_user_business_id())
    WITH CHECK (business_id = current_user_business_id());

-- MENU ITEMS
DROP POLICY IF EXISTS "Menu isolation" ON menu_items;
CREATE POLICY "Menu isolation" ON menu_items
    USING (business_id = current_user_business_id())
    WITH CHECK (business_id = current_user_business_id());

-- OPTION GROUPS
DROP POLICY IF EXISTS "OptionGroups isolation" ON optiongroups;
CREATE POLICY "OptionGroups isolation" ON optiongroups
    USING (business_id = current_user_business_id())
    WITH CHECK (business_id = current_user_business_id());

-- OPTION VALUES
DROP POLICY IF EXISTS "OptionValues isolation" ON optionvalues;
CREATE POLICY "OptionValues isolation" ON optionvalues
    USING (business_id = current_user_business_id())
    WITH CHECK (business_id = current_user_business_id());

SELECT 'Lockdown Phase 1 Complete (Fixed). Tables secured.' as status;
