-- ============================================================
-- 🔓 EMERGENCY FIX: DISABLE RLS ON EMPLOYEES
-- ============================================================
-- You are correct. I enabled RLS to secure the data, but it locked the Login screen.
-- This script turns it OFF so you can log in again immediately.

ALTER TABLE employees DISABLE ROW LEVEL SECURITY;

SELECT 'RLS Disabled on employees table. Login should work now.' as status;
