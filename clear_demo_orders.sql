-- CLEAN DEMO ORDERS ONLY
DO $$
DECLARE
    demo_id UUID := '22222222-2222-2222-2222-222222222222';
BEGIN
    -- Delete items first (FK constraint)
    DELETE FROM order_items 
    WHERE order_id IN (SELECT id FROM orders WHERE business_id = demo_id);

    -- Delete orders
    DELETE FROM orders 
    WHERE business_id = demo_id;
    
    RAISE NOTICE 'Deleted all orders for Demo Business: %', demo_id;
END $$;
