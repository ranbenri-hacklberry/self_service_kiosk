-- Debug: Allow all authenticated inserts to supplier_orders for now to rule out mismatched ID types
-- We will tighten this later once it works.

ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Orders Access Policy" ON supplier_orders;

CREATE POLICY "Orders Access Policy" ON supplier_orders
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Also for items
DROP POLICY IF EXISTS "Order Items Access Policy" ON supplier_order_items;

CREATE POLICY "Order Items Access Policy" ON supplier_order_items
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
