
-- Fix missing columns in supplier_order_items
ALTER TABLE supplier_order_items 
ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS inventory_item_id BIGINT REFERENCES inventory_items(id),
ADD COLUMN IF NOT EXISTS supplier_order_id BIGINT REFERENCES supplier_orders(id);
