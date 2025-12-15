
-- Rename 'quantity' to 'ordered_quantity_units' if that's what the DB expects, or drop the constraint
-- It seems the DB has 'ordered_quantity_units' NOT NULL.
-- Let's check what columns we actually have first.
SELECT column_name, is_nullable, data_type 
FROM information_schema.columns 
WHERE table_name = 'supplier_order_items';
