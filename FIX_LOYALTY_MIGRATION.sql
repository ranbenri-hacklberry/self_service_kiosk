-- ========================================
-- FIX: Update get_loyalty_balance to read from NEW system
-- ========================================
-- The NEW system uses loyalty_cards.points_balance
-- The OLD system used customers.loyalty_coffee_count

CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance INTEGER;
    v_card_exists BOOLEAN;
BEGIN
    -- Check if loyalty card exists in NEW system
    SELECT points_balance, TRUE INTO v_balance, v_card_exists
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;
    
    -- If no card in NEW system, check OLD system and migrate
    IF NOT FOUND THEN
        -- Try to get from OLD system (customers table)
        SELECT loyalty_coffee_count INTO v_balance
        FROM public.customers
        WHERE phone = p_phone;
        
        -- If found in old system, create card in new system
        IF FOUND AND v_balance IS NOT NULL AND v_balance > 0 THEN
            INSERT INTO public.loyalty_cards (customer_phone, points_balance)
            VALUES (p_phone, v_balance)
            ON CONFLICT (customer_phone) DO NOTHING;
        ELSE
            v_balance := 0;
        END IF;
    END IF;
    
    -- Ensure we return a valid number
    IF v_balance IS NULL THEN
        v_balance := 0;
    END IF;
    
    RETURN jsonb_build_object('balance', v_balance);
END;
$$;

-- Test with the customer
SELECT get_loyalty_balance('0548888888');

-- Verify both systems
SELECT 
    'OLD SYSTEM' as system,
    phone,
    loyalty_coffee_count as count
FROM customers 
WHERE phone = '0548888888'
UNION ALL
SELECT 
    'NEW SYSTEM' as system,
    customer_phone as phone,
    points_balance as count
FROM loyalty_cards 
WHERE customer_phone = '0548888888';
