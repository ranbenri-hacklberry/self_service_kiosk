-- MANAGE PILOT EMPLOYEES
-- 1. Fixes incorrect phone formats (converts 972... to 05...)
-- 2. Fixes invalid PINs (alphanumeric to numeric)
-- 3. Provides template to Adding/Updating users

-- FIX: NETANEL'S PIN (Cannot type 'nati1111' on keypad)
UPDATE employees
SET pin_code = '1111'
WHERE name = 'נתנאל' AND pin_code = 'nati1111';

-- FIX: PHONE NUMBERS (Login expects 05...)
-- Updates '9725...' to '05...' for David, Rani, Sharon
UPDATE employees
SET whatsapp_phone = REPLACE(whatsapp_phone, '9725', '05')
WHERE whatsapp_phone LIKE '9725%';

-- TEMPLATE TO ADD/UPDATE EMPLOYEES:
-- Uncomment and fill in to add/update
/*
INSERT INTO employees (name, whatsapp_phone, pin_code, access_level, is_admin, business_id)
VALUES 
    ('New User', '0501234567', '1234', 'staff', false, '11111111-1111-1111-1111-111111111111')
ON CONFLICT (whatsapp_phone) 
DO UPDATE SET 
    name = EXCLUDED.name,
    pin_code = EXCLUDED.pin_code,
    access_level = EXCLUDED.access_level;
*/

-- VERIFY FINAL LIST
SELECT 
    name,
    access_level as role,
    whatsapp_phone as phone,
    pin_code as pin,
    is_admin
FROM employees
WHERE business_id = '11111111-1111-1111-1111-111111111111'
ORDER BY access_level, name;
