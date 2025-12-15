-- ========================================
-- FIXED v2: handle_loyalty_adjustment function
-- ========================================
-- Fix: Changed 'adjustment' to 'manual_adjustment'

CREATE OR REPLACE FUNCTION public.handle_loyalty_adjustment(
    p_phone TEXT,
    p_order_id UUID,
    p_points_delta INTEGER,
    p_redeemed_delta INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card_id UUID;
    v_new_balance INTEGER;
BEGIN
    -- 1. Find or Create Card
    SELECT id INTO v_card_id
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;

    IF v_card_id IS NULL THEN
        -- Create new card if doesn't exist
        INSERT INTO public.loyalty_cards (customer_phone, points_balance)
        VALUES (p_phone, GREATEST(0, p_points_delta - (p_redeemed_delta * 10)))
        RETURNING id INTO v_card_id;
        
        v_new_balance := GREATEST(0, p_points_delta - (p_redeemed_delta * 10));
    ELSE
        -- 2. Update Card and get NEW balance
        UPDATE public.loyalty_cards
        SET points_balance = GREATEST(0, points_balance + p_points_delta - (p_redeemed_delta * 10)),
            total_free_coffees_redeemed = total_free_coffees_redeemed + p_redeemed_delta,
            last_updated = NOW()
        WHERE id = v_card_id
        RETURNING points_balance INTO v_new_balance;
    END IF;

    -- 3. Log Transaction (CHANGED: 'adjustment' → 'manual_adjustment')
    INSERT INTO public.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, p_points_delta - (p_redeemed_delta * 10), 'manual_adjustment');

    -- 4. Return success with CORRECT new balance
    RETURN jsonb_build_object(
        'success', true, 
        'newCount', v_new_balance,
        'addedPoints', p_points_delta
    );
END;
$$;

-- Verify the function was created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_loyalty_adjustment';
