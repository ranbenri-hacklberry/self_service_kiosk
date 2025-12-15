-- Fix duplicate loyalty cards
-- 1. Update transactions from the bad card to the good card
UPDATE loyalty_transactions
SET card_id = (SELECT id FROM loyalty_cards WHERE customer_phone = '0548888888')
WHERE card_id = (SELECT id FROM loyalty_cards WHERE customer_phone = 'c49bd0e1-3a26-4306-9127-7668f60abf64');

-- 2. Delete the bad card
DELETE FROM loyalty_cards 
WHERE customer_phone = 'c49bd0e1-3a26-4306-9127-7668f60abf64';

-- 3. Recalculate balance for the good card
WITH calc AS (
    SELECT 
        SUM(change_amount) as total_points
    FROM loyalty_transactions
    WHERE card_id = (SELECT id FROM loyalty_cards WHERE customer_phone = '0548888888')
)
UPDATE loyalty_cards
SET points_balance = (SELECT total_points FROM calc)
WHERE customer_phone = '0548888888';

-- 4. Check final result
SELECT * FROM loyalty_cards WHERE customer_phone = '0548888888';
