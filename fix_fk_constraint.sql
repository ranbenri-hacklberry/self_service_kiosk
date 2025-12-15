
-- Drop the legacy constraint causing issues
ALTER TABLE supplier_order_items DROP CONSTRAINT IF EXISTS supplier_order_items_inventory_item_id_fkey;

-- Re-create it pointing to the correct 'inventory_items' table
ALTER TABLE supplier_order_items 
ADD CONSTRAINT supplier_order_items_inventory_item_id_fkey 
FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id);
