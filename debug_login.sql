-- DEBUG EMPLOYEES & RLS
-- 1. Check if RLS is enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'employees';

-- 2. List all policies on employees
SELECT * FROM pg_policies WHERE tablename = 'employees';

-- 3. List all employees (to verify PINs and IDs)
-- WARNING: This exposes PINs in output. Clean up later.
SELECT id, name, pin_code, business_id, access_level 
FROM employees;

-- 4. Test visibility as anonymous (Simulated)
-- This is hard to simulate perfectly in SQL editor, but we can check if data exists.
