-- ============================================================
-- 🔧 FIX PERMISSIONS & VERIFY DATA (LOGIN DEBUG)
-- ============================================================

-- 1. Explicitly Grant Permissions (just in case)
GRANT SELECT ON employees TO anon, authenticated, service_role;

-- 2. Ensure RLS is OFF
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

-- 3. Verify the Demo User exists and PIN is '1234'
SELECT id, name, pin_code, business_id 
FROM employees 
WHERE name = 'משתמש דמו';

-- 4. Verify Total Count
SELECT count(*) as total_employees FROM employees;

SELECT 'Permissions granted. RLS disabled. Please try login again.' as status;
