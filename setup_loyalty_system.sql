-- Create loyalty_cards table
CREATE TABLE IF NOT EXISTS public.loyalty_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_phone TEXT NOT NULL UNIQUE, -- Linking by phone is safer for kiosks
    points_balance INTEGER DEFAULT 0,
    total_free_coffees_redeemed INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create loyalty_transactions table
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID REFERENCES public.loyalty_cards(id),
    order_id UUID, -- Can be null for manual adjustments
    change_amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'redemption', 'manual_adjustment', 'cancellation')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_phone ON public.loyalty_cards(customer_phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_card ON public.loyalty_transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order ON public.loyalty_transactions(order_id);

-- RPC: Get Loyalty Balance
CREATE OR REPLACE FUNCTION public.get_loyalty_balance(
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card RECORD;
BEGIN
    SELECT * INTO v_card
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;

    IF v_card IS NULL THEN
        RETURN jsonb_build_object('exists', false, 'balance', 0);
    END IF;

    RETURN jsonb_build_object(
        'exists', true, 
        'balance', v_card.points_balance, 
        'redeemed', v_card.total_free_coffees_redeemed
    );
END;
$$;

-- RPC: Handle Loyalty Purchase (Idempotent)
CREATE OR REPLACE FUNCTION public.handle_loyalty_purchase(
    p_phone TEXT,
    p_order_id UUID,
    p_items_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_card_id UUID;
    v_current_balance INTEGER;
    v_existing_tx RECORD;
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

    -- 3. Add Points
    UPDATE public.loyalty_cards
    SET points_balance = points_balance + p_items_count,
        last_updated = NOW()
    WHERE id = v_card_id;

    -- 4. Log Transaction
    INSERT INTO public.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, p_items_count, 'purchase');

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_current_balance + p_items_count,
        'added_points', p_items_count
    );
END;
$$;

-- RPC: Handle Loyalty Cancellation
CREATE OR REPLACE FUNCTION public.handle_loyalty_cancellation(
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tx RECORD;
    v_card_id UUID;
BEGIN
    -- 1. Find the original purchase transaction
    SELECT * INTO v_tx
    FROM public.loyalty_transactions
    WHERE order_id = p_order_id AND transaction_type = 'purchase';

    IF v_tx IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Original transaction not found');
    END IF;

    v_card_id := v_tx.card_id;

    -- 2. Check if already cancelled
    IF EXISTS (
        SELECT 1 FROM public.loyalty_transactions 
        WHERE order_id = p_order_id AND transaction_type = 'cancellation'
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already cancelled');
    END IF;

    -- 3. Deduct Points (Reverse the change_amount)
    UPDATE public.loyalty_cards
    SET points_balance = points_balance - v_tx.change_amount,
        last_updated = NOW()
    WHERE id = v_card_id;

    -- 4. Log Cancellation
    INSERT INTO public.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, -v_tx.change_amount, 'cancellation');

    RETURN jsonb_build_object('success', true, 'deducted_points', v_tx.change_amount);
END;
$$;
