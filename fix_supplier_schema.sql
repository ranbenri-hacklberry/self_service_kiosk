
-- 1. Add supplier_id column if not exists
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS supplier_id bigint REFERENCES suppliers(id);

-- 2. Insert missing suppliers from inventory_items.supplier text column
INSERT INTO suppliers (name)
SELECT DISTINCT supplier 
FROM inventory_items 
WHERE supplier IS NOT NULL 
AND supplier NOT IN (SELECT name FROM suppliers);

-- 3. Update inventory_items.supplier_id based on name matching
UPDATE inventory_items
SET supplier_id = suppliers.id
FROM suppliers
WHERE inventory_items.supplier = suppliers.name;
