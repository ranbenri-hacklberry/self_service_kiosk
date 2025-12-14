-- LINK AUTH USER TO PILOT EMPLOYEE
-- Problem: The Pilot Employee record exists but is not linked to your Login User (auth_user_id is NULL).
-- Fix: We will forcefully link your Login ID to this specific Pilot Employee record.

DO $$
DECLARE
    -- The User currently logged in (from logs)
    v_auth_user_id UUID := '7946632e-d8a8-47bf-8a53-9b299b85bff2';
    
    -- The Pilot Employee record you showed me
    v_target_employee_id UUID := '8b844dfa-c7f6-49ad-93af-3d4b073d1f14';
BEGIN
    -- 1. Detach this Auth User from any OTHER employee records (e.g. the Demo one)
    -- This prevents ambiguity.
    UPDATE employees 
    SET auth_user_id = NULL 
    WHERE auth_user_id = v_auth_user_id AND id != v_target_employee_id;
    
    RAISE NOTICE 'Detached Auth User from old employee records.';

    -- 2. Attach Auth User to the correct Pilot Employee record
    UPDATE employees
    SET auth_user_id = v_auth_user_id
    WHERE id = v_target_employee_id;
    
    RAISE NOTICE 'SUCCESS: Linked Auth User % to Pilot Employee %', v_auth_user_id, v_target_employee_id;
    
END $$;
