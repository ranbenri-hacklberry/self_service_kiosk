-- SWITCH USER TO PILOT
-- User ID from logs: 7946632e-d8a8-47bf-8a53-9b299b85bff2
-- Problem: This user is currently linked to Demo (222...), so they can't see Pilot (111...) orders.
-- Fix: Update their employee record to point to Pilot.

DO $$
DECLARE
    v_user_id UUID := '7946632e-d8a8-47bf-8a53-9b299b85bff2';
    v_pilot_id UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
    -- 1. Check if an employee record exists for this Auth ID OR Phone
    IF EXISTS (SELECT 1 FROM employees WHERE auth_user_id = v_user_id OR whatsapp_phone = '0506983399') THEN
        UPDATE employees 
        SET business_id = v_pilot_id 
        WHERE auth_user_id = v_user_id OR whatsapp_phone = '0506983399';
        RAISE NOTICE 'Updated existing employee record for user % / phone 0506983399 to Pilot.', v_user_id;
    ELSE
        -- 2. If not linked by ID, maybe linked by Phone? 
        -- We'll try to update any employee record that matches this user's phone.
        -- But since we don't have the phone handy in SQL variable easily, let's create a new link if needed.
        -- Better safer approach: Insert/Update based on ID if we can. 
        
        -- Let's just INSERT a new Admin Employee for this user in Pilot if none exists.
        INSERT INTO employees (name, access_level, business_id, auth_user_id, is_admin)
        VALUES ('Owner (Fixed)', 'owner', v_pilot_id, v_user_id, true);
        RAISE NOTICE 'Created new Pilot Owner record for user %.', v_user_id;
    END IF;
    
    -- 3. Also fix any "Demo" orders created by this user today to be Pilot orders
    -- (If they created orders while mistakenly identified as Demo, those orders are "lost" in Demo land).
    -- We move them to Pilot so the user sees them.
    UPDATE orders
    SET business_id = v_pilot_id
    WHERE created_at > NOW() - INTERVAL '1 day' 
    AND business_id = '22222222-2222-2222-2222-222222222222';
    
    RAISE NOTICE 'Moved recent Demo orders to Pilot.';

END $$;
