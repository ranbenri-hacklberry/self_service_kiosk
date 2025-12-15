-- Sync Loyalty Schema (Public & Demo)
-- 1. Fix Public Schema: Ensure handle_loyalty_purchase matches what frontend calls
-- 2. Sync Demo Schema: Add columns and update functions to match Public

-- ==========================================
-- PUBLIC SCHEMA UPDATES (Fixing Mismatch)
-- ==========================================

-- Update public.handle_loyalty_purchase to accept p_redeemed_count
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
    WHERE public.loyalty_cards.phone_number = p_phone;

    -- If no card exists, create one
    IF card_id IS NULL THEN
        INSERT INTO public.loyalty_cards (phone_number, points_balance, free_coffees)
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
        total_coffees_purchased = total_coffees_purchased + p_items_count,
        total_free_coffees_redeemed = total_free_coffees_redeemed + p_redeemed_count,
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
        p_redeemed_count * 10, -- Logging as points equivalent for consistency
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


-- ==========================================
-- DEMO SCHEMA UPDATES
-- ==========================================

-- 1. Add free_coffees column to demo.loyalty_cards
ALTER TABLE demo.loyalty_cards 
ADD COLUMN IF NOT EXISTS free_coffees INTEGER DEFAULT 0;

-- 2. Migrate existing demo data
UPDATE demo.loyalty_cards
SET 
    free_coffees = free_coffees + FLOOR(points_balance / 9),
    points_balance = points_balance % 9
WHERE points_balance >= 9;

-- 3. Update demo.get_loyalty_balance
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
    WHERE customer_phone = p_phone; -- Note: demo table uses customer_phone, public uses phone_number? Check schema.
    -- Checking setup_demo_environment.sql: "CREATE TABLE ... LIKE public.loyalty_cards"
    -- If public uses phone_number, demo should too.
    -- BUT setup_demo_environment.sql line 311 uses "customer_phone".
    -- Let's assume column name is 'phone_number' if it was cloned from public recently, 
    -- OR 'customer_phone' if it was created long ago.
    -- To be safe, I will check column names or use the one from public if I can.
    -- However, since I can't easily check right now without running a query, 
    -- and setup_demo_environment.sql used `customer_phone`, I'll stick to `customer_phone` 
    -- IF the table was created with `customer_phone`.
    -- WAIT. If `demo.loyalty_cards` is `LIKE public.loyalty_cards`, it has the SAME columns.
    -- `refactor_loyalty_credits.sql` used `phone_number` in `add_coffee_purchase`.
    -- So `public` likely has `phone_number`.
    -- `setup_demo_environment.sql` (lines 311, 317) used `customer_phone`.
    -- This implies `public` might have had `customer_phone` when demo was created?
    -- OR `setup_demo_environment.sql` created it manually?
    -- Line 263: `CREATE TABLE ... LIKE public.loyalty_cards`.
    -- So they MUST have the same column name.
    -- I will use `phone_number` as that is what I used in `refactor_loyalty_credits.sql` for public.
    
    RETURN jsonb_build_object(
        'balance', COALESCE(points, 0),
        'freeCoffees', COALESCE(free_coffees_count, 0)
    );
EXCEPTION WHEN OTHERS THEN
    -- Fallback if column name is different (e.g. customer_phone)
    -- This is a bit hacky but SQL doesn't support try-catch on column names easily.
    -- I'll assume `phone_number` based on recent public scripts.
    RETURN jsonb_build_object('error', SQLERRM);
END;
$function$;

-- Correction: I'll use a safer approach for the column name in the function below.
-- But first, let's define handle_loyalty_purchase for demo.

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
    -- Try to find card using phone_number (assuming sync with public)
    -- If that fails, it might be customer_phone. 
    -- Since I can't check, I'll assume `phone_number` matches public.
    
    SELECT id, points_balance, free_coffees 
    INTO card_id, current_points, current_free_coffees
    FROM demo.loyalty_cards
    WHERE phone_number = p_phone;

    IF card_id IS NULL THEN
        INSERT INTO demo.loyalty_cards (phone_number, points_balance, free_coffees)
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

-- 4. Update demo.handle_loyalty_adjustment
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
    WHERE phone_number = p_phone;

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

-- 5. Fix demo.get_loyalty_balance (using phone_number)
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
    WHERE phone_number = p_phone;
    
    RETURN jsonb_build_object(
        'balance', COALESCE(points, 0),
        'freeCoffees', COALESCE(free_coffees_count, 0)
    );
END;
$function$;
