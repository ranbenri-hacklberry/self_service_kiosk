-- RPC: Handle Loyalty Purchase (Idempotent) with Redemption Support
CREATE OR REPLACE FUNCTION public.handle_loyalty_purchase(
    p_phone TEXT,
    p_order_id UUID,
    p_items_count INTEGER,
    p_redeemed_count INTEGER DEFAULT 0 -- New parameter for redemption
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card_id UUID;
    v_current_balance INTEGER;
    v_existing_tx RECORD;
    v_points_change INTEGER;
BEGIN
    -- 1. Find or Create Card
    INSERT INTO public.loyalty_cards (customer_phone)
    VALUES (p_phone)
    ON CONFLICT (customer_phone) DO NOTHING;

    SELECT id, points_balance INTO v_card_id, v_current_balance
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;

    -- 2. Idempotency Check: Did we already process this order?
    SELECT * INTO v_existing_tx
    FROM public.loyalty_transactions
    WHERE order_id = p_order_id AND transaction_type = 'purchase';

    IF v_existing_tx IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Already processed', 
            'new_balance', v_current_balance,
            'added_points', 0
        );
    END IF;

    -- 3. Calculate Net Points Change
    -- Add points for items, subtract 10 points per redeemed coffee
    v_points_change := p_items_count - (p_redeemed_count * 10);

    -- 4. Update Card
    UPDATE public.loyalty_cards
    SET points_balance = points_balance + v_points_change,
        total_free_coffees_redeemed = total_free_coffees_redeemed + p_redeemed_count,
        last_updated = NOW()
    WHERE id = v_card_id;

    -- 5. Log Transaction (Purchase)
    INSERT INTO public.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, p_items_count, 'purchase');

    -- 6. Log Transaction (Redemption) if applicable
    IF p_redeemed_count > 0 THEN
        INSERT INTO public.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
        VALUES (v_card_id, p_order_id, -(p_redeemed_count * 10), 'redemption');
    END IF;

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_current_balance + v_points_change,
        'added_points', p_items_count,
        'redeemed_coffees', p_redeemed_count
    );
END;
$$;
