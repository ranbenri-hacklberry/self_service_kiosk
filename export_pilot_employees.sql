-- EXPORT PILOT EMPLOYEES
-- Lists all staff members belonging to the Pilot Business

SELECT 
    name,
    access_level as role,   -- Mapped from access_level
    whatsapp_phone as phone,
    pin_code as pin,        -- Mapped from pin_code
    is_admin,
    business_id
FROM employees
WHERE business_id = '11111111-1111-1111-1111-111111111111'
ORDER BY access_level, name;
