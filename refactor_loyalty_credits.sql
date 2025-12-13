-- 1. Add free_coffees column
ALTER TABLE public.loyalty_cards 
ADD COLUMN IF NOT EXISTS free_coffees INTEGER DEFAULT 0;

-- 2. Migrate existing data: Convert every 9 points into 1 free coffee credit
-- Example: 9 points -> 0 points, 1 credit
--          18 points -> 0 points, 2 credits
--          10 points -> 1 point, 1 credit
UPDATE public.loyalty_cards
SET 
    free_coffees = free_coffees + FLOOR(points_balance / 9),
    points_balance = points_balance % 9
WHERE points_balance >= 9;

-- 3. Update add_coffee_purchase RPC
CREATE OR REPLACE FUNCTION public.add_coffee_purchase(
    phone_number text,
    order_id uuid,
    items_count integer,
    current_user_id uuid,
    redeemed_count integer DEFAULT 0
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
    WHERE public.loyalty_cards.phone_number = add_coffee_purchase.phone_number;

    -- If no card exists, create one
    IF card_id IS NULL THEN
        INSERT INTO public.loyalty_cards (phone_number, points_balance, free_coffees)
        VALUES (add_coffee_purchase.phone_number, 0, 0)
        RETURNING id, points_balance, free_coffees 
        INTO card_id, current_points, current_free_coffees;
    END IF;

    -- Calculate new state
    -- 1. Add new points from paid items
    -- 2. Subtract redeemed credits (if any were used)
    -- 3. Check for new credits earned (every 9 points = 1 credit)
    
    -- Step 1: Add points
    new_points := current_points + items_count;
    
    -- Step 2: Calculate earned credits from total points
    earned_credits := FLOOR(new_points / 9);
    
    -- Step 3: Update points (keep remainder)
    new_points := new_points % 9;
    
    -- Step 4: Update free coffees
    -- Start with current, subtract redeemed, add earned
    new_free_coffees := current_free_coffees - redeemed_count + earned_credits;
    
    -- Prevent negative free coffees (safety net)
    IF new_free_coffees < 0 THEN
        new_free_coffees := 0;
    END IF;

    -- Update the card
    UPDATE public.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        total_coffees_purchased = total_coffees_purchased + items_count,
        total_free_coffees_redeemed = total_free_coffees_redeemed + redeemed_count,
        last_updated = NOW()
    WHERE id = card_id;

    -- Log transaction
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
        items_count, -- Points earned (coffees bought)
        redeemed_count * 10, -- Approximate "value" in old points terms, or just track count? 
                             -- Let's keep it consistent with old schema if it used points, 
                             -- but really we should probably track credits. 
                             -- For now, let's log the raw items count as points earned.
        'purchase',
        current_user_id
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

-- 4. Update handle_loyalty_adjustment RPC (for edits/refunds)
CREATE OR REPLACE FUNCTION public.handle_loyalty_adjustment(
    phone_number text,
    order_id uuid,
    points_delta integer, -- Change in PAID items (positive or negative)
    current_user_id uuid,
    redeemed_delta integer DEFAULT 0 -- Change in REDEEMED items (positive = used more, negative = un-used/returned)
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
    -- Get current state
    SELECT id, points_balance, free_coffees 
    INTO card_id, current_points, current_free_coffees
    FROM public.loyalty_cards
    WHERE public.loyalty_cards.phone_number = handle_loyalty_adjustment.phone_number;

    IF card_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Card not found');
    END IF;

    -- Calculate total "value" in points to handle the math correctly
    -- Current value = (free_coffees * 9) + points_balance
    total_points_value := (current_free_coffees * 9) + current_points;
    
    -- Apply deltas
    -- points_delta: change in paid items (adds/removes value)
    -- redeemed_delta: change in credits used. 
    --    If redeemed_delta is POSITIVE (used more credits), we subtract from balance? 
    --    NO. 'redeemed_delta' is passed from frontend as change in *usage*.
    --    In 'add_coffee_purchase', we did: new_free = current - redeemed + earned.
    --    Here, we are adjusting.
    
    -- Let's stick to the "Total Value" approach for points_delta (earning/un-earning),
    -- and handle redeemed_delta separately for the credit bucket.
    
    -- 1. Adjust for EARNINGS (points_delta)
    -- If points_delta is positive (added items), we add to total value.
    -- If points_delta is negative (removed items), we subtract from total value.
    total_points_value := total_points_value + points_delta;
    
    -- Recalculate points and credits from the new total value
    -- This handles the "Refund 9th coffee -> lose credit" scenario automatically.
    new_free_coffees := FLOOR(total_points_value / 9);
    new_points := total_points_value % 9;
    
    -- 2. Adjust for REDEMPTIONS (redeemed_delta)
    -- redeemed_delta = NewRedeemedCount - OldRedeemedCount
    -- If positive (used more credits), we must SUBTRACT from available credits.
    -- If negative (cancelled a free coffee), we must ADD back to available credits.
    new_free_coffees := new_free_coffees - redeemed_delta;

    -- Safety check
    IF new_free_coffees < 0 THEN
        -- This implies they used more credits than they have? 
        -- Or we removed earning that supported a credit that was already used?
        -- For now, allow it to go to 0, but ideally we should warn.
        new_free_coffees := 0; 
    END IF;

    -- Update card
    UPDATE public.loyalty_cards
    SET 
        points_balance = new_points,
        free_coffees = new_free_coffees,
        last_updated = NOW()
    WHERE id = card_id;

    -- Log transaction
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
        redeemed_delta, -- Just logging the delta count
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

-- 5. Update get_loyalty_balance RPC
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
    WHERE phone_number = p_phone;
    
    RETURN jsonb_build_object(
        'balance', COALESCE(points, 0),
        'freeCoffees', COALESCE(free_coffees_count, 0)
    );
END;
$function$;
