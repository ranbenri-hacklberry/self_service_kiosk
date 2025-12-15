-- FORCE OPEN PERMISSIONS for Supplier Orders & Items
-- Run this to fix the "new row violates row-level security policy" error.

BEGIN;

-- 1. Supplier Orders
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Orders Access Policy" ON supplier_orders;
DROP POLICY IF EXISTS "Order Access" ON supplier_orders;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON supplier_orders;
DROP POLICY IF EXISTS "service_role_access" ON supplier_orders;

CREATE POLICY "Force Open Orders" ON supplier_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 2. Supplier Order Items
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order Items Access Policy" ON supplier_order_items;
DROP POLICY IF EXISTS "Item Access" ON supplier_order_items;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON supplier_order_items;

CREATE POLICY "Force Open Order Items" ON supplier_order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 3. Grant Permissions
GRANT ALL ON supplier_orders TO authenticated;
GRANT ALL ON supplier_order_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE supplier_orders_id_seq TO authenticated;

COMMIT;
