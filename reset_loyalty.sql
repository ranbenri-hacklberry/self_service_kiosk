-- Reset loyalty points for testing
UPDATE loyalty_cards 
SET points_balance = 0 
WHERE customer_phone = '0548888888';

-- Verify the result
SELECT * FROM loyalty_cards WHERE customer_phone = '0548888888';
