-- DEBUG: Multi-Tenancy Leak Investigation

-- 1. Check the Demo Employee's Business ID
SELECT id, name, whatsapp_phone, business_id 
FROM employees 
WHERE whatsapp_phone = '0500000000' OR name = 'משתמש דמו';

-- 2. Check the MOST RECENT Order (the one that leaked)
SELECT 
    id, 
    created_at, 
    business_id, 
    customer_name, 
    total_amount 
FROM orders 
ORDER BY created_at DESC 
LIMIT 1;

-- 3. Check what "Pilot Cafe" ID is, for comparison
SELECT id, name FROM businesses;
