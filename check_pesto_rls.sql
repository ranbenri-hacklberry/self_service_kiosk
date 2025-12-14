-- CHECK BUSINESS ID OF PESTO INGREDIENTS
SELECT id, name, business_id 
FROM inventory_items 
WHERE id IN (63, 43, 54, 101, 61);
