-- GRANT INVENTORY UPDATE PERMISSIONS
-- Run this in Supabase SQL Editor to fix the "Error saving stock" (400) issue.

-- 1. Enable RLS (if not already)
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

-- 2. Create Policy for Updates
-- Allow authenticated users (employees) to update inventory items
-- We check if the business_id matches their own business
CREATE POLICY "Allow employees to update their business inventory"
ON inventory_items
FOR UPDATE
USING (
    business_id IN (
        SELECT business_id 
        FROM employees 
        WHERE id = auth.uid()::uuid
    )
);

-- 3. Also Ensure Select Policy exists (usually does, but to be safe)
CREATE POLICY "Allow employees to view their business inventory"
ON inventory_items
FOR SELECT
USING (
    business_id IN (
        SELECT business_id 
        FROM employees 
        WHERE id = auth.uid()::uuid
    )
);

-- 4. Grant Update Permission on the table to Authenticated role
GRANT UPDATE ON inventory_items TO authenticated;

-- 5. Allow Updating Supplier Orders (Receiving Goods)
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow employees to update supplier orders"
ON supplier_orders
FOR UPDATE
USING (
    business_id IN (
        SELECT business_id 
        FROM employees 
        WHERE id = auth.uid()::uuid
    )
);

GRANT UPDATE ON supplier_orders TO authenticated;
