-- CHECK ITEM 8 OWNERSHIP
SELECT id, name, business_id, price 
FROM menu_items 
WHERE id = 8;

-- CHECK PILOT BUSINESS ID (for reference)
SELECT id, name FROM businesses WHERE name LIKE '%Pilot%';
