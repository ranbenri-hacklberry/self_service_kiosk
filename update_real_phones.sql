-- UPDATE REAL EMPLOYEE PHONES & PINS
-- Based on user input

-- 1. Update Ella
UPDATE employees
SET whatsapp_phone = '0587119845'
WHERE name = 'אלה';

-- 2. Update Netanel (and ensure PIN is 1111)
UPDATE employees
SET 
    whatsapp_phone = '0556822072',
    pin_code = '1111'
WHERE name = 'נתנאל';

-- Verify
SELECT name, whatsapp_phone, pin_code, access_level 
FROM employees 
WHERE name IN ('אלה', 'נתנאל');
