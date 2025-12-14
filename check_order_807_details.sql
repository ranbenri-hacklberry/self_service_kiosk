-- DETAILED INSPECTION OF ORDER 807
-- Objective: To find out EXACTLY why this order is hidden from the KDS.

SELECT 
    o.id,
    o.order_number,
    o.business_id,
    CASE 
        WHEN o.business_id = '11111111-1111-1111-1111-111111111111' THEN 'PILOT'
        WHEN o.business_id = '22222222-2222-2222-2222-222222222222' THEN 'DEMO'
        ELSE 'UNKNOWN'
    END as business_name,
    o.order_status,
    o.is_paid,
    o.created_at,
    NOW() as current_server_time
FROM orders o
WHERE o.order_number IN (807, 806, 805);

-- Also check your current employee link to be sure
SELECT * FROM employees WHERE whatsapp_phone = '0506983399';
