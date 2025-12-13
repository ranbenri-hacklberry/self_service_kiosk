
-- Deleting "Supplier Eggs" (id 4)
-- Since we verified no items are linked to it (via supplier_id), this is safe.

DELETE FROM suppliers WHERE id = 4;
