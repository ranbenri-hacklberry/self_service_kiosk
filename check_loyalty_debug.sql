SELECT * FROM public.loyalty_cards WHERE customer_phone = '0548888888';
SELECT * FROM public.loyalty_transactions 
WHERE card_id = (SELECT id FROM public.loyalty_cards WHERE customer_phone = '0548888888')
ORDER BY created_at DESC;
