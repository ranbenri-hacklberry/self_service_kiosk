-- 1. Check the User and their Employee link
SELECT 
    u.id as user_id, 
    u.email, 
    u.phone, 
    e.business_id as employee_business_id,
    e.name as employee_name
FROM auth.users u
LEFT JOIN employees e ON u.id = e.auth_user_id
WHERE u.id = '7946632e-d8a8-47bf-8a53-9b299b85bff2';

-- 2. Check the specific orders seen in logs (assuming they are active)
-- We search for orders created today containing the items "הפוך קטן" or "אמריקנו"
SELECT 
    o.id, 
    o.business_id, 
    o.order_status,
    mi.name as item_name
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE o.created_at > NOW() - INTERVAL '1 day'
AND (mi.name LIKE '%הפוך%' OR mi.name LIKE '%אמריקנו%');
