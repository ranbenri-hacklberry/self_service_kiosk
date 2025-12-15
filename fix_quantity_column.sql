
-- Add quantity column if missing
ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;

-- Fix potentially missing supplier_id column in supplier_orders (if created wrong) and ensure it allows nulls
ALTER TABLE supplier_orders ALTER COLUMN supplier_id DROP NOT NULL;
