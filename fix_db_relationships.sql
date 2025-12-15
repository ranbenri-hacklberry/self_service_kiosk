
-- 1. Ensure supplier_orders has correct columns
ALTER TABLE supplier_orders 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent';

-- 2. Ensure supplier_order_items has foreign key to inventory_items
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'supplier_order_items_inventory_item_id_fkey'
  ) THEN
    ALTER TABLE supplier_order_items
    ADD CONSTRAINT supplier_order_items_inventory_item_id_fkey
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);
  END IF;
END $$;
