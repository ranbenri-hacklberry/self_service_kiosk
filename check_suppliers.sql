-- CHECK SUPPLIERS TABLE
SELECT * FROM suppliers;

-- CHECK SUPPLIER ORDERS
SELECT * FROM supplier_orders;

-- CHECK POLICIES
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename IN ('suppliers', 'supplier_orders', 'supplier_order_items');
