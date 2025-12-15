-- ============================================================
-- 🧹 SETUP DEMO BUSINESS (CLEAN SLATE)
-- ============================================================
-- OBJECTIVE: Initialize 'Demo Business' (2222...) with ONE sample item.
-- ============================================================

DO $$
DECLARE
    demo_id UUID := '22222222-2222-2222-2222-222222222222';
    demo_name TEXT := 'סקיילין דמו';
BEGIN
    -- 1. Ensure Business Exists
    INSERT INTO businesses (id, name, created_at, settings)
    VALUES (demo_id, demo_name, now(), '{}')
    ON CONFLICT (id) DO NOTHING;

    -- 2. WIPE Existing Data for Demo (Clean Slate)
    -- Must delete child records first to satisfy Foreign Keys!
    DELETE FROM time_clock_events WHERE employee_id IN (SELECT id FROM employees WHERE business_id = demo_id);
     DELETE FROM menuitemoptions WHERE item_id IN (SELECT id FROM menu_items WHERE business_id = demo_id);
    DELETE FROM recipe_ingredients WHERE recipe_id IN (SELECT id FROM recipes WHERE business_id = demo_id);
    DELETE FROM recipes WHERE business_id = demo_id;
    DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE business_id = demo_id);

    DELETE FROM menu_items WHERE business_id = demo_id;
    DELETE FROM inventory_items WHERE business_id = demo_id;
    DELETE FROM orders WHERE business_id = demo_id;
    DELETE FROM employees WHERE business_id = demo_id; 
    -- (Note: wiping employees might disconnect the user, we will re-link below)

    -- 3. Create ONE Sample Inventory Item
    INSERT INTO inventory_items (name, category, unit, current_stock, cost_per_unit, business_id)
    VALUES ('פולי קפה (דמו)', 'קפה', 'kg', 5, 60, demo_id);

    -- 4. Create ONE Sample Menu Item
    INSERT INTO menu_items (name, price, category, description, is_in_stock, business_id)
    VALUES ('קפוצ׳ינו דמו', 14, 'קפה', 'קפה הפוך מעולה להדגמה', true, demo_id);

    -- 5. Link Demo User (if exists) via Employees
    -- Access Level: Admin, Pin: 1234
    -- We assume the user exists in auth.users? Or we just create an employee record.
    -- For now, creates an employee record so they can "login" with PIN if using that flow.
    INSERT INTO employees (name, pin_code, access_level, business_id, is_admin)
    VALUES ('משתמש דמו', '1234', 'Manager', demo_id, true);

END $$;

SELECT 'Demo Business (2222...) reset with 1 sample item.' as status;
