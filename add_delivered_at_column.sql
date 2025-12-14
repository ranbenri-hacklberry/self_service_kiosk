-- Add missing columns to supplier_orders table
-- The app tries to update 'delivered_at' and 'delivery_status', ensuring they exist.

ALTER TABLE supplier_orders 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

ALTER TABLE supplier_orders 
ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
