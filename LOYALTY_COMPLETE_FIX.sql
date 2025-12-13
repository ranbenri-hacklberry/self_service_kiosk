-- ============================================
-- COMPLETE LOYALTY FIX - Clean Rewrite
-- ============================================
-- BUSINESS LOGIC:
-- - Customer accumulates points (0-9)
-- - Every 10th coffee is FREE (given immediately, not saved as credit)
-- - Points reset to 0 (or remainder) after reaching 10
-- - free_coffees column is NOT USED (always 0)
-- ============================================

-- STEP 1: Reset all free_coffees to 0 (clean slate)
UPDATE public.loyalty_cards SET free_coffees = 0;
UPDATE demo.loyalty_cards SET free_coffees = 0;

-- STEP 2: Create clean PUBLIC RPC
CREATE OR REPLACE FUNCTION public.handle_loyalty_purchase(
    p_phone text,
    p_order_id uuid,
    p_items_count integer,
    p_redeemed_count integer DEFAULT 0  -- NOT USED in new model, kept for compatibility
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    card_id uuid;
    current_points integer;
    new_points integer;
    free_given integer;
BEGIN
    -- Get or create loyalty card
    SELECT id, COALESCE(points_balance, 0)
    INTO card_id, current_points
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone;

    IF card_id IS NULL THEN
        INSERT INTO public.loyalty_cards (customer_phone, points_balance, free_coffees)
        VALUES (p_phone, 0, 0)
        RETURNING id, points_balance INTO card_id, current_points;
    END IF;

    -- Simple calculation:
    -- Add all coffees to points
    -- Each time we hit 10, one coffee was free
    new_points := current_points + p_items_count;
    free_given := FLOOR(new_points / 10);
    new_points := new_points % 10;

    -- Update the card (free_coffees stays 0 - no saved credits!)
    UPDATE public.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = 0,  -- ALWAYS 0 in new model
        total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
        total_free_coffees_redeemed = COALESCE(total_free_coffees_redeemed, 0) + free_given,
        last_updated = NOW()
    WHERE id = card_id;

    -- Log transaction
    INSERT INTO public.loyalty_transactions (
        card_id, order_id, change_amount, points_earned, points_redeemed, transaction_type
    ) VALUES (
        card_id, p_order_id, p_items_count, p_items_count, free_given, 'purchase'
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_points,
        'free_given', free_given
    );
END;
$function$;

-- STEP 3: Create clean DEMO RPC
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
    new_points integer;
    free_given integer;
BEGIN
    SELECT id, COALESCE(points_balance, 0)
    INTO card_id, current_points
    FROM demo.loyalty_cards
    WHERE customer_phone = p_phone;

    IF card_id IS NULL THEN
        INSERT INTO demo.loyalty_cards (customer_phone, points_balance, free_coffees)
        VALUES (p_phone, 0, 0)
        RETURNING id, points_balance INTO card_id, current_points;
    END IF;

    new_points := current_points + p_items_count;
    free_given := FLOOR(new_points / 10);
    new_points := new_points % 10;

    UPDATE demo.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = 0,
        total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
        total_free_coffees_redeemed = COALESCE(total_free_coffees_redeemed, 0) + free_given,
        last_updated = NOW()
    WHERE id = card_id;

    INSERT INTO demo.loyalty_transactions (
        card_id, order_id, change_amount, points_earned, points_redeemed, transaction_type
    ) VALUES (
        card_id, p_order_id, p_items_count, p_items_count, free_given, 'purchase'
    );

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', new_points,
        'free_given', free_given
    );
END;
$function$;

-- STEP 4: Grant permissions
GRANT EXECUTE ON FUNCTION public.handle_loyalty_purchase(text, uuid, integer, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.handle_loyalty_purchase(text, uuid, integer, integer) TO anon, authenticated, service_role;
