-- CHECK ALL ITEMS OWNERSHIP DISTRIBUTION
SELECT business_id, COUNT(*) as count, string_agg(name, ', ') as examples
FROM menu_items
GROUP BY business_id;

-- ALSO CHECK SPECIFICALLY FOR NULL (SHARED)
SELECT id, name, business_id FROM menu_items WHERE business_id IS NULL;
