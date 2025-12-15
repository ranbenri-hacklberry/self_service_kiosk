-- ============================================
-- FIX: Change loyalty threshold from 9 to 10
-- Buy 9, get 10th free = divide by 10!
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
    earned_credits integer;
BEGIN
    -- Get or create loyalty card
    SELECT id, COALESCE(points_balance, 0), COALESCE(free_coffees, 0)
    INTO card_id, current_points, current_free_coffees
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;

    -- If no card exists, create one
    IF card_id IS NULL THEN
        INSERT INTO public.loyalty_cards (customer_phone, points_balance, free_coffees)
        VALUES (p_phone, 0, 0)
        RETURNING id, points_balance, free_coffees 
        INTO card_id, current_points, current_free_coffees;
    END IF;

    -- Calculate new points (add purchased - redeemed stays in credits)
    new_points := current_points + p_items_count;
    
    -- *** FIXED: Divide by 10, not 9! Buy 9, get 10th free ***
    earned_credits := FLOOR(new_points / 10);
    new_points := new_points % 10;
    
    -- Calculate new free coffees (add earned - subtract redeemed)
    new_free_coffees := current_free_coffees + earned_credits - p_redeemed_count;
    IF new_free_coffees < 0 THEN
        new_free_coffees := 0;
    END IF;

    -- Update the card
    UPDATE public.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
        total_free_coffees_redeemed = COALESCE(total_free_coffees_redeemed, 0) + p_redeemed_count,
        last_updated = NOW()
    WHERE id = card_id;

    -- Log transaction
    INSERT INTO public.loyalty_transactions (
        card_id, order_id, change_amount, points_earned, points_redeemed, transaction_type
    ) VALUES (
        card_id, p_order_id, p_items_count, p_items_count, p_redeemed_count, 'purchase'
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_points,
        'new_free_coffees', new_free_coffees,
        'earned_credits', earned_credits,
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
    earned_credits integer;
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
    
    -- *** FIXED: Divide by 10, not 9! ***
    earned_credits := FLOOR(new_points / 10);
    new_points := new_points % 10;
    
    new_free_coffees := current_free_coffees + earned_credits - p_redeemed_count;
    IF new_free_coffees < 0 THEN
        new_free_coffees := 0;
    END IF;

    UPDATE demo.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
        total_free_coffees_redeemed = COALESCE(total_free_coffees_redeemed, 0) + p_redeemed_count,
        last_updated = NOW()
    WHERE id = card_id;

    INSERT INTO demo.loyalty_transactions (
        card_id, order_id, change_amount, points_earned, points_redeemed, transaction_type
    ) VALUES (
        card_id, p_order_id, p_items_count, p_items_count, p_redeemed_count, 'purchase'
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_points,
        'new_free_coffees', new_free_coffees,
        'earned_credits', earned_credits,
        'added_points', p_items_count
    );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_loyalty_purchase(text, uuid, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.handle_loyalty_purchase(text, uuid, integer, integer) TO anon, authenticated, service_role;
