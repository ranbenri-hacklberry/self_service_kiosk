-- Fix handle_loyalty_purchase to populate change_amount
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
    -- Get current state
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

    -- Calculate new state
    new_points := current_points + p_items_count;
    earned_credits := FLOOR(new_points / 9);
    new_points := new_points % 9;
    
    new_free_coffees := current_free_coffees - p_redeemed_count + earned_credits;
    
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

    -- Log transaction with change_amount
    INSERT INTO public.loyalty_transactions (
        card_id,
        order_id,
        points_earned,
        points_redeemed,
        transaction_type,
        change_amount -- Required column
    )
    VALUES (
        card_id,
        p_order_id,
        p_items_count,
        p_redeemed_count * 10, -- Assuming 10 points per coffee for redemption tracking? Or just count?
        'purchase',
        p_items_count -- Net change in points (ignoring free coffees for simple tracking)
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

-- Fix handle_loyalty_adjustment to populate change_amount
CREATE OR REPLACE FUNCTION public.handle_loyalty_adjustment(
    phone_number text,
    order_id uuid,
    points_delta integer,
    current_user_id uuid,
    redeemed_delta integer DEFAULT 0
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
    total_points_value integer;
BEGIN
    SELECT id, points_balance, free_coffees 
    INTO card_id, current_points, current_free_coffees
    FROM public.loyalty_cards
    WHERE customer_phone = phone_number;

    IF card_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Card not found');
    END IF;

    total_points_value := (current_free_coffees * 9) + current_points;
    total_points_value := total_points_value + points_delta;
    
    new_free_coffees := FLOOR(total_points_value / 9);
    new_points := total_points_value % 9;
    
    new_free_coffees := new_free_coffees - redeemed_delta;

    IF new_free_coffees < 0 THEN
        new_free_coffees := 0; 
    END IF;

    UPDATE public.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        last_updated = NOW()
    WHERE id = card_id;

    INSERT INTO public.loyalty_transactions (
        card_id,
        order_id,
        points_earned,
        points_redeemed,
        transaction_type,
        created_by,
        change_amount -- Required column
    )
    VALUES (
        card_id,
        order_id,
        points_delta,
        redeemed_delta,
        'manual_adjustment',
        current_user_id,
        points_delta -- Net change
    );

    RETURN jsonb_build_object(
        'success', true,
        'newPoints', new_points,
        'newFreeCoffees', new_free_coffees,
        'message', 'Adjustment processed successfully'
    );
END;
$function$;
