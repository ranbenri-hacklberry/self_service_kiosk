-- MOVE ALL DEMO ORDERS TO PILOT
-- This is a cleanup script to rescue any orders stranded in Demo business (222...)
-- and move them to Pilot (111...) so they appear in the KDS.

DO $$
DECLARE
    v_pilot_id UUID := '11111111-1111-1111-1111-111111111111';
    v_demo_id UUID := '22222222-2222-2222-2222-222222222222';
    v_count INT;
BEGIN
    
    -- 1. Count how many orders are currently in Demo
    SELECT COUNT(*) INTO v_count FROM orders WHERE business_id = v_demo_id;
    RAISE NOTICE 'Found % orders in Demo business.', v_count;

    -- 2. Update them to Pilot
    UPDATE orders
    SET business_id = v_pilot_id
    WHERE business_id = v_demo_id;
    
    RAISE NOTICE 'Moved % orders from Demo to Pilot.', v_count;
    
    -- 3. Also update order items (though they don't always have business_id, some schemas do)
    -- If your order_items table has business_id, uncomment below:
    -- UPDATE order_items SET business_id = v_pilot_id WHERE business_id = v_demo_id;

END $$;
