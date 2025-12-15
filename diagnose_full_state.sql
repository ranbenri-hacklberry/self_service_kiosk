-- DIAGNOSE KDS STATE (The "Red Pill" Script) 💊
-- This script reveals exactly what the database sees.

-- 1. Setup simulated environment for the specific user
-- We set the current transaction's user ID to your ID so we see what you see.
SET LOCAL "request.jwt.claim.sub" = '7946632e-d8a8-47bf-8a53-9b299b85bff2';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
    v_user_id UUID := '7946632e-d8a8-47bf-8a53-9b299b85bff2';
    v_employee_record RECORD;
    v_business_id UUID;
    v_order_count INT;
BEGIN
    RAISE NOTICE '=== 1. CHECKING USER LINK ===';
    SELECT * INTO v_employee_record FROM employees WHERE auth_user_id = v_user_id;
    
    IF v_employee_record IS NULL THEN
        RAISE NOTICE '❌ User is NOT linked to any employee record via auth_user_id!';
    ELSE
        RAISE NOTICE '✅ User linked to Employee: % (Business: %)', v_employee_record.name, v_employee_record.business_id;
        v_business_id := v_employee_record.business_id;
    END IF;

    RAISE NOTICE '=== 2. CHECKING ORDERS (RAW) ===';
    -- Check orders 805, 806, 807 regardless of business
    FOR v_employee_record IN 
        SELECT id, order_number, business_id, order_status, created_at 
        FROM orders 
        WHERE order_number IN (805, 806, 807)
    LOOP
        RAISE NOTICE '📦 Order % | Business: % | Status: % | Created: %', 
            v_employee_record.order_number, 
            v_employee_record.business_id, 
            v_employee_record.order_status, 
            v_employee_record.created_at;
            
        IF v_business_id IS NOT NULL AND v_employee_record.business_id != v_business_id THEN
            RAISE NOTICE '   ⚠️ MISMATCH! Order belongs to different business than User.';
        END IF;
    END LOOP;

    RAISE NOTICE '=== 3. SIMULATING FUNCTION CALL ===';
    -- We'll try to get orders from the last 48 hours to be safe
    SELECT COUNT(*) INTO v_order_count 
    FROM get_kds_orders((NOW() - INTERVAL '2 days')::timestamptz);
    
    RAISE NOTICE '📊 Function returned % orders (looking back 2 days).', v_order_count;
    
    IF v_order_count = 0 THEN
        RAISE NOTICE '❌ Function returns NOTHING. Possible reasons:';
        RAISE NOTICE '   - User not identified correctly in function logic.';
        RAISE NOTICE '   - Orders are not in the correct status (pending/in_progress/ready/paid).';
        RAISE NOTICE '   - Date filter excluding orders.';
    ELSE
        RAISE NOTICE '✅ Function works! Returned % orders. If KDS is empty, check Frontend.', v_order_count;
    END IF;

END $$;
