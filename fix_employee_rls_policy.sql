-- ============================================================
-- 🔓 FIX LOGIN RLS (UNBLOCK EMPLOYEES TABLE)
-- ============================================================
-- Issue: We enabled RLS on 'employees' but didn't add a policy.
-- Result: No one can read the table, so Login fails (can't check PIN).

-- 1. Create a Policy allowing public read access to employees
-- (Required for client-side login with Supabase currently implemented)
DROP POLICY IF EXISTS "Public read access to employees" ON employees;

CREATE POLICY "Public read access to employees"
ON employees
FOR SELECT
TO public
USING (true);

-- 2. Allow Admins/Service Role to insert/update (for Setup scripts)
DROP POLICY IF EXISTS "Admins can manage employees" ON employees;

CREATE POLICY "Admins can manage employees"
ON employees
FOR ALL
TO authenticated, anon, service_role -- temporarily allow all to fix setup scripts if running as query editor
USING (true)
WITH CHECK (true);

-- 3. Also fix 'business_id' defaulting in `create_employee` if implicit
-- (Triggers should handle this now)

SELECT 'Employees table unlocked. Login should work.' as status;
