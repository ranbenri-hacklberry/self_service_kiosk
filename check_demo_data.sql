-- CHECK FOR DEMO BUSINESS
SELECT * FROM businesses WHERE id::text LIKE '2222%';

-- CHECK INVENTORY FOR DEMO BUSINESS
SELECT count(*) as demo_inventory_count 
FROM inventory_items 
WHERE business_id::text LIKE '2222%';

-- CHECK MENU ITEMS FOR DEMO BUSINESS (if column exists, otherwise this fails and tells us they share)
SELECT count(*) as demo_menu_items_count
FROM menu_items 
WHERE id IN (
  -- Try to infer ownership if business_id doesn't exist yet
  -- This part depends on if we added business_id to menu_items yet.
  -- Based on previous checks, we likely haven't strictly enforced it.
  SELECT id FROM menu_items LIMIT 1
);

-- CHECK ORDERS FOR DEMO BUSINESS
SELECT count(*) as demo_orders_count
FROM orders
WHERE business_id::text LIKE '2222%';
