-- ========================================
-- FIX: Create or replace get_loyalty_balance RPC
-- ========================================

CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    -- Get balance from loyalty_cards table
    SELECT points_balance INTO v_balance
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;
    
    -- If no card exists, return 0
    IF v_balance IS NULL THEN
        v_balance := 0;
    END IF;
    
    RETURN jsonb_build_object('balance', v_balance);
END;
$$;

-- Test the function
SELECT get_loyalty_balance('0548888888');

-- Verify loyalty card exists
SELECT customer_phone, points_balance, total_free_coffees_redeemed 
FROM loyalty_cards 
WHERE customer_phone = '0548888888';
