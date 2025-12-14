-- EXPORT PILOT CUSTOMERS DATA
-- Lists all customers belonging to the Pilot Business
-- Includes: Name, Phone, Loyalty Points, Join Date, Last Visit (calculated from orders if possible)

-- 11111111-1111-1111-1111-111111111111 is the Pilot Business ID

SELECT 
    c.name,
    c.phone_number,
    c.loyalty_coffee_count as "Punches on Card",
    lc.free_coffees as "Free Coffees Stored",
    c.created_at as "Join Date",
    -- Try to find last order date
    MAX(o.created_at) as "Last Order Date",
    COUNT(o.id) as "Total Orders"
FROM customers c
LEFT JOIN loyalty_cards lc ON c.phone_number = lc.customer_phone
LEFT JOIN orders o ON c.phone_number = o.customer_phone
WHERE c.business_id = '11111111-1111-1111-1111-111111111111'
GROUP BY c.id, c.name, c.phone_number, c.loyalty_coffee_count, lc.free_coffees, c.created_at
ORDER BY MAX(o.created_at) DESC NULLS LAST;
