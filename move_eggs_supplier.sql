
-- Update items linked to "Egg Supplier" (4) to "Morning Star" (2)
UPDATE inventory_items 
SET supplier_id = 2 
WHERE supplier_id = 4;

-- Delete the empty "Egg Supplier"
DELETE FROM suppliers WHERE id = 4;
