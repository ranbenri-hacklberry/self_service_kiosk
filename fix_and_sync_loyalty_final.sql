-- Fix and Sync Loyalty System (Final Version)
-- 1. Adds missing columns to Demo
-- 2. Updates ALL functions in Public and Demo to use the correct column 'customer_phone'
-- 3. Ensures function names match Frontend expectations (handle_loyalty_purchase)

-- ==========================================
-- 1. DEMO SCHEMA MIGRATION
-- ==========================================

ALTER TABLE demo.loyalty_cards 
ADD COLUMN IF NOT EXISTS free_coffees INTEGER DEFAULT 0;

-- Convert existing points to credits in Demo
UPDATE demo.loyalty_cards
SET 
    free_coffees = free_coffees + FLOOR(points_balance / 9),
    points_balance = points_balance % 9
WHERE points_balance >= 9;

-- ==========================================
-- 2. PUBLIC SCHEMA FUNCTIONS (Fixing column names)
-- ==========================================

-- RPC: handle_loyalty_purchase (Public)
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
    -- Get current state using correct column 'customer_phone'
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

    -- Log transaction
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

-- RPC: handle_loyalty_adjustment (Public)
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
    WHERE customer_phone = phone_number; -- Fixed column name

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
        created_by
    )
    VALUES (
        card_id,
        order_id,
        points_delta,
        redeemed_delta,
        'adjustment',
        current_user_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'newPoints', new_points,
        'newFreeCoffees', new_free_coffees,
        'message', 'Adjustment processed successfully'
    );
END;
$function$;

-- RPC: get_loyalty_balance (Public)
CREATE OR REPLACE FUNCTION public.get_loyalty_balance(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    points integer;
    free_coffees_count integer;
BEGIN
    SELECT points_balance, free_coffees
    INTO points, free_coffees_count
    FROM public.loyalty_cards
    WHERE customer_phone = p_phone; -- Fixed column name
    
    RETURN jsonb_build_object(
        'balance', COALESCE(points, 0),
        'freeCoffees', COALESCE(free_coffees_count, 0)
    );
END;
$function$;

-- ==========================================
-- 3. DEMO SCHEMA FUNCTIONS
-- ==========================================

-- RPC: handle_loyalty_purchase (Demo)
CREATE OR REPLACE FUNCTION demo.handle_loyalty_purchase(
    p_phone text,
    p_order_id uuid,
    p_items_count integer,
    p_redeemed_count integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
AS $function$
DECLARE
    current_points integer;
    current_free_coffees integer;
    new_points integer;
    new_free_coffees integer;
    earned_credits integer;
    card_id uuid;
BEGIN
    SELECT id, points_balance, free_coffees 
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
    earned_credits := FLOOR(new_points / 9);
    new_points := new_points % 9;
    
    new_free_coffees := current_free_coffees - p_redeemed_count + earned_credits;
    
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

-- RPC: handle_loyalty_adjustment (Demo)
CREATE OR REPLACE FUNCTION demo.handle_loyalty_adjustment(
    p_phone text,
    p_order_id uuid,
    p_points_delta integer,
    p_redeemed_delta integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
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
    FROM demo.loyalty_cards
    WHERE customer_phone = p_phone;

    IF card_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Card not found');
    END IF;

    total_points_value := (current_free_coffees * 9) + current_points;
    total_points_value := total_points_value + p_points_delta;
    
    new_free_coffees := FLOOR(total_points_value / 9);
    new_points := total_points_value % 9;
    
    new_free_coffees := new_free_coffees - p_redeemed_delta;

    IF new_free_coffees < 0 THEN
        new_free_coffees := 0; 
    END IF;

    UPDATE demo.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        last_updated = NOW()
    WHERE id = card_id;

    INSERT INTO demo.loyalty_transactions (
        card_id,
        order_id,
        points_earned,
        points_redeemed,
        transaction_type
    )
    VALUES (
        card_id,
        p_order_id,
        p_points_delta,
        p_redeemed_delta,
        'adjustment'
    );

    RETURN jsonb_build_object(
        'success', true,
        'newPoints', new_points,
        'newFreeCoffees', new_free_coffees,
        'message', 'Adjustment processed successfully'
    );
END;
$function$;

-- RPC: get_loyalty_balance (Demo)
CREATE OR REPLACE FUNCTION demo.get_loyalty_balance(p_phone text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
AS $function$
DECLARE
    points integer;
    free_coffees_count integer;
BEGIN
    SELECT points_balance, free_coffees
    INTO points, free_coffees_count
    FROM demo.loyalty_cards
    WHERE customer_phone = p_phone;
    
    RETURN jsonb_build_object(
        'balance', COALESCE(points, 0),
        'freeCoffees', COALESCE(free_coffees_count, 0)
    );
END;
$function$;

-- Cleanup
DROP FUNCTION IF EXISTS public.add_coffee_purchase(text, uuid, integer, uuid, integer);
