-- ============================================
-- FIX: 10th coffee is FREE NOW, not a credit for later!
-- When reaching 10, the coffee is given for free immediately,
-- NOT stored as a credit for future use.
-- ============================================

-- Fix PUBLIC version
CREATE OR REPLACE FUNCTION public.handle_loyalty_purchase(
    p_phone text,
    p_order_id uuid,
    p_items_count integer,
    p_redeemed_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    card_id uuid;
    current_points integer;
    current_free_coffees integer;
    new_points integer;
    new_free_coffees integer;
    earned_free_now integer;
BEGIN
    -- Get or create loyalty card
    SELECT id, COALESCE(points_balance, 0), COALESCE(free_coffees, 0)
    INTO card_id, current_points, current_free_coffees
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;

    IF card_id IS NULL THEN
        INSERT INTO public.loyalty_cards (customer_phone, points_balance, free_coffees)
        VALUES (p_phone, 0, 0)
        RETURNING id, points_balance, free_coffees 
        INTO card_id, current_points, current_free_coffees;
    END IF;

    -- Calculate progress: add ALL items (including free ones that triggered the reward)
    new_points := current_points + p_items_count;
    
    -- How many times did we cross 10? Each crossing = 1 free coffee NOW
    earned_free_now := FLOOR(new_points / 10);
    new_points := new_points % 10;
    
    -- Free coffees balance:
    -- - Subtract credits used from DB (p_redeemed_count)
    -- - Do NOT add earned_free_now (those were given immediately, not stored)
    new_free_coffees := current_free_coffees - p_redeemed_count;
    IF new_free_coffees < 0 THEN
        new_free_coffees := 0;
    END IF;

    -- Update the card
    UPDATE public.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
        total_free_coffees_redeemed = COALESCE(total_free_coffees_redeemed, 0) + p_redeemed_count + earned_free_now,
        last_updated = NOW()
    WHERE id = card_id;

    -- Log transaction
    INSERT INTO public.loyalty_transactions (
        card_id, order_id, change_amount, points_earned, points_redeemed, transaction_type
    ) VALUES (
        card_id, p_order_id, p_items_count, p_items_count, p_redeemed_count + earned_free_now, 'purchase'
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_points,
        'new_free_coffees', new_free_coffees,
        'earned_free_now', earned_free_now,
        'added_points', p_items_count
    );
END;
$function$;

-- Fix DEMO version
CREATE OR REPLACE FUNCTION demo.handle_loyalty_purchase(
    p_phone text,
    p_order_id uuid,
    p_items_count integer,
    p_redeemed_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    card_id uuid;
    current_points integer;
    current_free_coffees integer;
    new_points integer;
    new_free_coffees integer;
    earned_free_now integer;
BEGIN
    SELECT id, COALESCE(points_balance, 0), COALESCE(free_coffees, 0)
    INTO card_id, current_points, current_free_coffees
    FROM demo.loyalty_cards
    WHERE customer_phone = p_phone;

    IF card_id IS NULL THEN
        INSERT INTO demo.loyalty_cards (customer_phone, points_balance, free_coffees)
        VALUES (p_phone, 0, 0)
        RETURNING id, points_balance, free_coffees 
        INTO card_id, current_points, current_free_coffees;
    END IF;

    new_points := current_points + p_items_count;
    earned_free_now := FLOOR(new_points / 10);
    new_points := new_points % 10;
    
    new_free_coffees := current_free_coffees - p_redeemed_count;
    IF new_free_coffees < 0 THEN
        new_free_coffees := 0;
    END IF;

    UPDATE demo.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
        total_free_coffees_redeemed = COALESCE(total_free_coffees_redeemed, 0) + p_redeemed_count + earned_free_now,
        last_updated = NOW()
    WHERE id = card_id;

    INSERT INTO demo.loyalty_transactions (
        card_id, order_id, change_amount, points_earned, points_redeemed, transaction_type
    ) VALUES (
        card_id, p_order_id, p_items_count, p_items_count, p_redeemed_count + earned_free_now, 'purchase'
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_points,
        'new_free_coffees', new_free_coffees,
        'earned_free_now', earned_free_now,
        'added_points', p_items_count
    );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_loyalty_purchase(text, uuid, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.handle_loyalty_purchase(text, uuid, integer, integer) TO anon, authenticated, service_role;
