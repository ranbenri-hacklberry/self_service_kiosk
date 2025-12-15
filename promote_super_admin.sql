-- PROMOTE TO SUPER ADMIN
-- Replace 'YOUR_EMAIL@EXAMPLE.COM' with your actual email address
-- Run this in Supabase SQL Editor

UPDATE employees
SET is_super_admin = TRUE
WHERE email = 'YOUR_EMAIL@EXAMPLE.COM';

-- Verify
SELECT * FROM employees WHERE is_super_admin = TRUE;
