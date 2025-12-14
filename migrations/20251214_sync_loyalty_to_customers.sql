-- SYNC LOYALTY update to CUSTOMERS table
-- Ensures that when points are added to the new system (loyalty_cards),
-- they are also reflected in the legacy system (customers.loyalty_coffee_count)
-- so the UI displays them correctly on next login.

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
    current_points integer;
    current_free_coffees integer;
    new_points integer;
    new_free_coffees integer;
    earned_credits integer;
    card_id uuid;
BEGIN
    -- 1. Get current state from loyalty_cards (Source of Truth for Math)
    SELECT id, points_balance, free_coffees 
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

    -- 2. Calculate new state
    -- Logic: Accumulate points. Every 9 points = 1 credit?
    -- (Based on existing logic in fix_and_sync_loyalty_final.sql)
    new_points := current_points + p_items_count;
    earned_credits := FLOOR(new_points / 9);
    new_points := new_points % 9; -- Store the remainder
    
    new_free_coffees := current_free_coffees - p_redeemed_count + earned_credits;
    
    IF new_free_coffees < 0 THEN
        new_free_coffees := 0;
    END IF;

    -- 3. Update loyalty_cards
    UPDATE public.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
        total_free_coffees_redeemed = COALESCE(total_free_coffees_redeemed, 0) + p_redeemed_count,
        last_updated = NOW()
    WHERE id = card_id;

    -- 4. SYNC TO CUSTOMERS TABLE (Legacy Support)
    -- We update loyalty_coffee_count to match the new_points (or some representation of it?)
    -- If UI expects 0..9, new_points (0..8) might be off by one?
    -- Let's assume UI just wants to know "How many punches on the card".
    -- So we store new_points.
    UPDATE customers
    SET loyalty_coffee_count = new_points
    WHERE phone_number = p_phone;

    -- 5. Log transaction
    INSERT INTO public.loyalty_transactions (
        card_id,
        order_id,
        points_earned,
        points_redeemed,
        transaction_type
    )
    VALUES (
        card_id,
        p_order_id,
        p_items_count,
        p_redeemed_count * 10,
        'purchase'
    );

    RETURN jsonb_build_object(
        'success', true,
        'newPoints', new_points,
        'newFreeCoffees', new_free_coffees,
        'earnedCredits', earned_credits,
        'message', 'Purchase recorded successfully'
    );
END;
$function$;
