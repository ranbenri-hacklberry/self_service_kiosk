-- CHECK EMPLOYEES COLUMNS & UPDATE DEMO USER
-- 1. Get columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees';

-- 2. Update Demo User with a phone number (if verified column exists, I'll assume 'whatsapp_phone' from previous context)
-- If it doesn't exist, this will fail, which is fine for a check.
UPDATE employees 
SET whatsapp_phone = '0500000000' 
WHERE name = 'משתמש דמו';

-- 3. Verify
SELECT id, name, pin_code, whatsapp_phone FROM employees WHERE name = 'משתמש דמו';
