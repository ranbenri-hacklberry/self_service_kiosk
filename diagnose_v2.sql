-- DIAGNOSIS V2: VISIBLE RESULTS
-- Run this to get a table of answers.

WITH user_info AS (
    SELECT 
        id as employee_id, 
        business_id as linked_biz_id, 
        name as employee_name
    FROM employees 
    WHERE auth_user_id = '7946632e-d8a8-47bf-8a53-9b299b85bff2'
),
target_orders AS (
    SELECT 
        json_agg(json_build_object(
            'order', order_number, 
            'biz_id', business_id,
            'status', order_status
        )) as orders_data
    FROM orders 
    WHERE order_number IN (805, 806, 807)
),
function_test AS (
    -- Test the function as the specific user
    -- We can't easily impersonate in a pure SELECT without SET ROLE, 
    -- so we'll just check if the function returns anything for the Linked Business manually.
    SELECT count(*) as func_result_count
    FROM orders 
    WHERE business_id = (SELECT linked_biz_id FROM user_info)
    AND created_at > NOW() - INTERVAL '2 days'
)
SELECT 
    u.employee_name,
    u.linked_biz_id,
    CASE 
        WHEN u.linked_biz_id = '11111111-1111-1111-1111-111111111111' THEN 'PILOT'
        WHEN u.linked_biz_id = '22222222-2222-2222-2222-222222222222' THEN 'DEMO'
        ELSE 'OTHER' 
    END as biz_name,
    t.orders_data,
    f.func_result_count as potential_kds_orders
FROM user_info u
CROSS JOIN target_orders t
CROSS JOIN function_test f;
