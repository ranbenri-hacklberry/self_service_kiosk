-- RESTORE READ ACCESS for Inventory & Suppliers
-- It seems permissions were lost or too strict. This opens them up for your user.

BEGIN;

-- 1. Suppliers: Allow Read for Authenticated
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Read Suppliers" ON suppliers;
CREATE POLICY "Allow Read Suppliers" ON suppliers FOR SELECT TO authenticated USING (true);

-- 2. Inventory Items: Allow Read/Write for Authenticated
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow Full Access Inventory" ON inventory_items;
CREATE POLICY "Allow Full Access Inventory" ON inventory_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Ensure permissions are granted
GRANT SELECT ON suppliers TO authenticated;
GRANT ALL ON inventory_items TO authenticated;

COMMIT;
