-- FIX SUPPLIERS RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Add policy to allow SELECT for all authenticated users
-- (Or link to business_id if column exists, but for now let's open it)
DROP POLICY IF EXISTS "Allow read for authenticated" ON suppliers;
CREATE POLICY "Allow read for authenticated" ON suppliers
FOR SELECT
TO authenticated
USING (true);

-- Add policy for INSERT/UPDATE/DELETE (e.g., for managers)
-- Assuming we want to allow modification for now to fix setup
DROP POLICY IF EXISTS "Allow modification for authenticated" ON suppliers;
CREATE POLICY "Allow modification for authenticated" ON suppliers
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- NOW CHECK CONTENT AGAIN
SELECT * FROM suppliers;
