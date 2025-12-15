-- Check Demo Schema
SELECT * FROM demo.loyalty_cards WHERE customer_phone = '0548888888';

-- Check Legacy Table (Public)
SELECT phone, loyalty_coffee_count FROM public.customers WHERE phone = '0548888888';

-- Check Legacy Table (Demo)
SELECT phone, loyalty_coffee_count FROM demo.customers WHERE phone = '0548888888';
