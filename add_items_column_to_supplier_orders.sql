
-- Add missing columns to supplier_orders to support the frontend logic
ALTER TABLE supplier_orders 
ADD COLUMN IF NOT EXISTS items JSONB,
ADD COLUMN IF NOT EXISTS supplier_name TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent',
ADD COLUMN IF NOT EXISTS delivery_date TIMESTAMP WITH TIME ZONE;

-- Ensure supplier_id is nullable if we want to allow ad-hoc suppliers (though code tries to send int or null)
ALTER TABLE supplier_orders ALTER COLUMN supplier_id DROP NOT NULL;
