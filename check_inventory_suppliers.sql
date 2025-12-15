-- CHECK ITEMS and their SUPPLIERS
SELECT 
    i.id AS item_id, 
    i.name AS item_name, 
    i.business_id AS item_business,
    i.supplier_id, 
    s.name AS supplier_name,
    s.business_id AS supplier_business
FROM inventory_items i
LEFT JOIN suppliers s ON i.supplier_id = s.id
WHERE i.business_id IS NOT NULL;  -- Focus on active items

-- Check for items with supplier_id BUT no matching supplier found (orphans)
SELECT * FROM inventory_items 
WHERE supplier_id IS NOT NULL 
AND supplier_id NOT IN (SELECT id FROM suppliers);

-- Check for items where item and supplier have DIFFERENT business_id
SELECT 
    i.id, i.name, i.business_id as item_biz, 
    s.id as sup_id, s.name, s.business_id as sup_biz
FROM inventory_items i
JOIN suppliers s ON i.supplier_id = s.id
WHERE i.business_id != s.business_id;
