-- MIGRATE CUSTOMERS TO PILOT
-- Objective: Ensure all existing customers belong to the Pilot Business (111...)
-- so their loyalty points are visible and usable.

DO $$
DECLARE
    v_pilot_id UUID := '11111111-1111-1111-1111-111111111111';
    v_count INT;
BEGIN
    -- 1. Count how many need moving (NULL or Demo or other)
    SELECT COUNT(*) INTO v_count 
    FROM customers 
    WHERE business_id IS DISTINCT FROM v_pilot_id;
    
    RAISE NOTICE 'Found % customers not linked to Pilot.', v_count;

    -- 2. Update them
    UPDATE customers
    SET business_id = v_pilot_id
    WHERE business_id IS DISTINCT FROM v_pilot_id;
    
    RAISE NOTICE 'Moved % customers to Pilot Business.', v_count;
    
END $$;
