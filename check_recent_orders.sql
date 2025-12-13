-- Check what's stored in the orders table for the latest order
SELECT 
    id,
    order_number,
    customer_name,
    total_amount,
    is_paid,
    created_at
FROM orders
ORDER BY created_at DESC
LIMIT 5;
