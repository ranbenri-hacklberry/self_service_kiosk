-- FIX MISSING EMPLOYEE PHONES
-- The Login system mandates a phone number to identify the user.
-- 'Ella' and 'Netanel' currently have active NULL phones, meaning they cannot login.

-- Assigning placeholder phones (User can change these later)
UPDATE employees
SET whatsapp_phone = '0500000001'
WHERE name = 'אלה' AND (whatsapp_phone IS NULL OR whatsapp_phone = '');

UPDATE employees
SET whatsapp_phone = '0500000002'
WHERE name = 'נתנאל' AND (whatsapp_phone IS NULL OR whatsapp_phone = '');

-- Verify
SELECT name, whatsapp_phone, pin_code 
FROM employees 
WHERE name IN ('אלה', 'נתנאל');
