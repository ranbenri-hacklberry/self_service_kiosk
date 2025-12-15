-- ========================================
-- CRITICAL FIX: Install handle_loyalty_adjustment function
-- ========================================
-- This function is required for loyalty adjustments in edit mode
-- Run this in Supabase SQL Editor immediately!

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
    v_current_balance INTEGER;
BEGIN
    -- 1. Find Card
    SELECT id, points_balance INTO v_card_id, v_current_balance
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;

    IF v_card_id IS NULL THEN
        -- Should not happen in edit mode usually, but handle it
        INSERT INTO public.loyalty_cards (customer_phone, points_balance)
        VALUES (p_phone, GREATEST(0, p_points_delta))
        RETURNING id, points_balance INTO v_card_id, v_current_balance;
    END IF;

    -- 2. Update Card
    UPDATE public.loyalty_cards
    SET points_balance = points_balance + p_points_delta - (p_redeemed_delta * 10),
        total_free_coffees_redeemed = total_free_coffees_redeemed + p_redeemed_delta,
        last_updated = NOW()
    WHERE id = v_card_id;

    -- 3. Log Transaction (Adjustment)
    INSERT INTO public.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, p_points_delta - (p_redeemed_delta * 10), 'adjustment');

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_current_balance + p_points_delta - (p_redeemed_delta * 10),
        'added_points', p_points_delta
    );
END;
$$;

-- Verify the function was created
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'handle_loyalty_adjustment';
