-- INSPECT CUSTOMERS & LOYALTY DISTRIBUTION
-- Check where the customers and their data currently live.

SELECT 
    COALESCE(business_id::text, 'NULL') as biz_id,
    CASE 
        WHEN business_id = '11111111-1111-1111-1111-111111111111' THEN 'PILOT'
        WHEN business_id = '22222222-2222-2222-2222-222222222222' THEN 'DEMO'
        ELSE 'OTHER/NULL'
    END as biz_name,
    COUNT(*) as customer_count
FROM customers
GROUP BY business_id;

-- Also check loyalty cards/points if that table exists
-- (Assuming table name is 'loyalty_club' or similar, failing gracefully if not)
-- Validating table names first via information_schema is safer but let's guess based on context.
-- Previous files referenced 'loyalty_cards' or columns on customers?
-- Let's check columns on customers first.

SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'customers';
