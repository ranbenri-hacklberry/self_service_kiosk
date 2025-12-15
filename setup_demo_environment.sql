-- Setup Demo Environment
-- This script creates a 'demo' schema and duplicates the necessary tables and functions
-- to ensure complete separation between production (public) and demo data.

-- 1. Create Schema
CREATE SCHEMA IF NOT EXISTS demo;

-- 2. Clone Tables (Structure Only for transactional tables, Data for static tables)

-- Customers
CREATE TABLE IF NOT EXISTS demo.customers (LIKE public.customers INCLUDING ALL);
-- Make sure sequences are separate if they exist (usually UUIDs, but good practice)

-- Menu Items (Clone Structure AND Data)
CREATE TABLE IF NOT EXISTS demo.menu_items (LIKE public.menu_items INCLUDING ALL);
-- Copy data if empty
INSERT INTO demo.menu_items 
SELECT * FROM public.menu_items 
WHERE NOT EXISTS (SELECT 1 FROM demo.menu_items);

-- Orders
CREATE TABLE IF NOT EXISTS demo.orders (LIKE public.orders INCLUDING ALL);

-- Order Items
CREATE TABLE IF NOT EXISTS demo.order_items (LIKE public.order_items INCLUDING ALL);

-- 3. Duplicate Functions in Demo Schema

-- submit_order_v2 (Copy of the latest version from public)
DROP FUNCTION IF EXISTS demo.submit_order_v2(text, text, jsonb, boolean, uuid, text, boolean, boolean, uuid, numeric, boolean, jsonb, numeric, int, boolean);

CREATE OR REPLACE FUNCTION demo.submit_order_v2(
    p_customer_phone text,
    p_customer_name text,
    p_items jsonb,
    p_is_paid boolean,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT NULL,
    p_refund boolean DEFAULT false,
    edit_mode boolean DEFAULT false,
    order_id uuid DEFAULT NULL,
    original_total numeric DEFAULT NULL,
    is_refund boolean DEFAULT false,
    p_cancelled_items jsonb DEFAULT '[]'::jsonb,
    p_final_total numeric DEFAULT NULL,
    p_original_coffee_count int DEFAULT NULL,
    p_is_quick_order boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public -- CRITICAL: Force search path to demo first!
AS $function$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_total_amount numeric;
    v_item jsonb;
    v_order_status text;
    v_order_item_id_str text;
    v_remaining_items int;
    v_was_paid boolean DEFAULT false;
    v_old_coffee_count int DEFAULT 0;
    v_new_coffee_count int DEFAULT 0;
    v_loyalty_delta int DEFAULT 0;
BEGIN
    -- DEBUG: Log incoming p_final_total
    RAISE NOTICE 'demo.submit_order_v2: p_final_total received = %', p_final_total;
    
    -- Determine Total Amount
    IF p_final_total IS NOT NULL THEN
        v_total_amount := p_final_total;
        RAISE NOTICE 'demo.submit_order_v2: Using p_final_total. v_total_amount = %', v_total_amount;
    ELSE
        -- Fallback: Calculate total from items
        SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
        RAISE NOTICE 'demo.submit_order_v2: Calculated from items. v_total_amount = %', v_total_amount;
    END IF;

    -- Determine initial status
    v_order_status := 'in_progress';

    IF edit_mode THEN
        v_order_id := order_id;
        RAISE NOTICE 'demo.submit_order_v2: EDIT MODE. Updating order % with total_amount = %', v_order_id, v_total_amount;
        
        -- Capture previous state for loyalty calculation
        SELECT is_paid INTO v_was_paid FROM demo.orders WHERE id = v_order_id;
        
        -- Calculate old coffee count (only if customer exists)
        IF p_customer_id IS NOT NULL THEN
            IF p_original_coffee_count IS NOT NULL THEN
                v_old_coffee_count := p_original_coffee_count;
                RAISE NOTICE 'demo.submit_order_v2: Using provided p_original_coffee_count = %', v_old_coffee_count;
            ELSE
                SELECT COALESCE(SUM(oi.quantity), 0)
                INTO v_old_coffee_count
                FROM demo.order_items oi
                JOIN demo.menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = v_order_id
                  AND oi.item_status != 'cancelled'
                  AND mi.is_hot_drink = true;
                RAISE NOTICE 'demo.submit_order_v2: Calculated v_old_coffee_count from DB = %', v_old_coffee_count;
            END IF;
        END IF;
        
        UPDATE demo.orders 
        SET 
            total_amount = v_total_amount, 
            is_paid = p_is_paid, 
            payment_method = p_payment_method, 
            is_refund = p_refund,
            refund_amount = CASE 
                WHEN p_refund AND original_total IS NOT NULL AND original_total > 0 
                THEN original_total - v_total_amount 
                ELSE 0 
            END
        WHERE id = v_order_id
        RETURNING order_number INTO v_order_number;
        
        -- Handle cancelled items
        IF jsonb_array_length(p_cancelled_items) > 0 THEN
            UPDATE demo.order_items
            SET item_status = 'cancelled'
            WHERE id IN (
                SELECT (item->>'id')::uuid
                FROM jsonb_array_elements(p_cancelled_items) AS item
            );
            
            -- Check if all items are now cancelled
            SELECT COUNT(*)
            INTO v_remaining_items
            FROM demo.order_items
            WHERE demo.order_items.order_id = v_order_id
              AND item_status != 'cancelled';
            
            -- If no items remain, mark order as cancelled
            IF v_remaining_items = 0 THEN
                UPDATE demo.orders
                SET order_status = 'cancelled'
                WHERE id = v_order_id;
                RAISE NOTICE 'demo.submit_order_v2: All items cancelled, marking order as cancelled';
            END IF;
        END IF;

    ELSE
        RAISE NOTICE 'demo.submit_order_v2: NEW ORDER. Creating with total_amount = %', v_total_amount;
        
        INSERT INTO demo.orders (
            customer_id, customer_name, customer_phone, 
            order_status, is_paid, payment_method, total_amount, 
            is_refund, refund_amount
        ) VALUES (
            p_customer_id, p_customer_name, p_customer_phone,
            v_order_status, p_is_paid, p_payment_method, v_total_amount,
            p_refund, CASE WHEN p_refund THEN v_total_amount ELSE 0 END
        )
        RETURNING id, order_number INTO v_order_id, v_order_number;
        
        -- Quick Order Logic: Update customer name to be the order number
        IF p_is_quick_order THEN
             UPDATE demo.orders
             SET customer_name = '#' || v_order_number
             WHERE id = v_order_id;
             RAISE NOTICE 'demo.submit_order_v2: Quick Order detected. Updated customer_name to #%', v_order_number;
        END IF;
        
        RAISE NOTICE 'demo.submit_order_v2: Order created. ID = %, Number = %', v_order_id, v_order_number;
    END IF;

    -- Insert/Update Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Extract order_item_id safely
        v_order_item_id_str := v_item->>'order_item_id';

        -- If item has an order_item_id (UUID), it's an update to an existing item
        IF v_order_item_id_str IS NOT NULL AND v_order_item_id_str != 'null' AND v_order_item_id_str != '' THEN
             UPDATE demo.order_items
             SET 
                quantity = (v_item->>'quantity')::int,
                mods = v_item->'mods',
                notes = v_item->>'notes',
                price = (v_item->>'price')::numeric
             WHERE id = v_order_item_id_str::uuid;
        ELSE
            -- New item
            INSERT INTO demo.order_items (
                order_id, menu_item_id, quantity, price, mods, item_status, notes
            ) VALUES (
                v_order_id,
                (v_item->>'item_id')::int,
                (v_item->>'quantity')::int,
                (v_item->>'price')::numeric,
                v_item->'mods',
                COALESCE(v_item->>'item_status', 'in_progress'),
                v_item->>'notes'
            );
        END IF;
    END LOOP;

    -- Loyalty Calculation Logic
    IF p_customer_id IS NOT NULL THEN
        -- Calculate new coffee count
        SELECT COALESCE(SUM(oi.quantity), 0)
        INTO v_new_coffee_count
        FROM demo.order_items oi
        JOIN demo.menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = v_order_id
          AND oi.item_status != 'cancelled'
          AND mi.is_hot_drink = true;

        -- Determine Delta
        IF p_is_paid THEN
            IF v_was_paid THEN
                -- Was paid, is paid -> Delta = New - Old
                v_loyalty_delta := v_new_coffee_count - v_old_coffee_count;
            ELSE
                -- Was NOT paid, is paid -> Delta = New (Add all)
                v_loyalty_delta := v_new_coffee_count;
            END IF;
        ELSE
            IF v_was_paid THEN
                -- Was paid, is NOT paid (refunded/cancelled payment) -> Delta = -Old (Remove all)
                v_loyalty_delta := -v_old_coffee_count;
            ELSE
                -- Was NOT paid, is NOT paid -> Delta = 0
                v_loyalty_delta := 0;
            END IF;
        END IF;

        -- Update Customer if delta is not 0
        IF v_loyalty_delta != 0 THEN
            UPDATE demo.customers
            SET loyalty_coffee_count = GREATEST(0, loyalty_coffee_count + v_loyalty_delta)
            WHERE id = p_customer_id;
            
            RAISE NOTICE 'demo.submit_order_v2: Updated loyalty for customer % by % points (Old=%, New=%)', 
                p_customer_id, v_loyalty_delta, v_old_coffee_count, v_new_coffee_count;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number
    );
END;
$function$;

-- Grant permissions
GRANT USAGE ON SCHEMA demo TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA demo TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA demo TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.submit_order_v2(text, text, jsonb, boolean, uuid, text, boolean, boolean, uuid, numeric, boolean, jsonb, numeric, int, boolean) TO anon, authenticated, service_role;

-- Also need to duplicate get_loyalty_count if it exists, or ensure it uses search_path
-- For now, let's assume get_loyalty_count is simple enough or we'll fix it if needed.

-- 4. Loyalty System Duplication

-- Loyalty Tables
CREATE TABLE IF NOT EXISTS demo.loyalty_cards (LIKE public.loyalty_cards INCLUDING ALL);
CREATE TABLE IF NOT EXISTS demo.loyalty_transactions (LIKE public.loyalty_transactions INCLUDING ALL);

-- RPC: Get Loyalty Balance (Demo)
CREATE OR REPLACE FUNCTION demo.get_loyalty_balance(
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
AS $$
DECLARE
    v_card RECORD;
BEGIN
    SELECT * INTO v_card
    FROM demo.loyalty_cards
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

-- RPC: Handle Loyalty Purchase (Demo)
CREATE OR REPLACE FUNCTION demo.handle_loyalty_purchase(
    p_phone TEXT,
    p_order_id UUID,
    p_items_count INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
AS $$
DECLARE
    v_card_id UUID;
    v_current_balance INTEGER;
    v_existing_tx RECORD;
BEGIN
    -- 1. Find or Create Card
    INSERT INTO demo.loyalty_cards (customer_phone)
    VALUES (p_phone)
    ON CONFLICT (customer_phone) DO NOTHING;

    SELECT id, points_balance INTO v_card_id, v_current_balance
    FROM demo.loyalty_cards
    WHERE customer_phone = p_phone;

    -- 2. Idempotency Check
    SELECT * INTO v_existing_tx
    FROM demo.loyalty_transactions
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
    UPDATE demo.loyalty_cards
    SET points_balance = points_balance + p_items_count,
        last_updated = NOW()
    WHERE id = v_card_id;

    -- 4. Log Transaction
    INSERT INTO demo.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, p_items_count, 'purchase');

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_current_balance + p_items_count,
        'added_points', p_items_count
    );
END;
$$;

-- RPC: Handle Loyalty Cancellation (Demo)
CREATE OR REPLACE FUNCTION demo.handle_loyalty_cancellation(
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
AS $$
DECLARE
    v_tx RECORD;
    v_card_id UUID;
BEGIN
    -- 1. Find the original purchase transaction
    SELECT * INTO v_tx
    FROM demo.loyalty_transactions
    WHERE order_id = p_order_id AND transaction_type = 'purchase';

    IF v_tx IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Original transaction not found');
    END IF;

    v_card_id := v_tx.card_id;

    -- 2. Check if already cancelled
    IF EXISTS (
        SELECT 1 FROM demo.loyalty_transactions 
        WHERE order_id = p_order_id AND transaction_type = 'cancellation'
    ) THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already cancelled');
    END IF;

    -- 3. Deduct Points
    UPDATE demo.loyalty_cards
    SET points_balance = points_balance - v_tx.change_amount,
        last_updated = NOW()
    WHERE id = v_card_id;

    -- 4. Log Cancellation
    INSERT INTO demo.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, -v_tx.change_amount, 'cancellation');

    RETURN jsonb_build_object('success', true, 'deducted_points', v_tx.change_amount);
END;
$$;

-- RPC: Handle Loyalty Adjustment (Demo - for Edit Mode)
CREATE OR REPLACE FUNCTION demo.handle_loyalty_adjustment(
    p_phone TEXT,
    p_order_id UUID,
    p_points_delta INTEGER,
    p_redeemed_delta INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = demo, public
AS $$
DECLARE
    v_card_id UUID;
    v_current_balance INTEGER;
BEGIN
    -- 1. Find Card
    SELECT id, points_balance INTO v_card_id, v_current_balance
    FROM demo.loyalty_cards
    WHERE customer_phone = p_phone;

    IF v_card_id IS NULL THEN
        INSERT INTO demo.loyalty_cards (customer_phone, points_balance)
        VALUES (p_phone, GREATEST(0, p_points_delta))
        RETURNING id, points_balance INTO v_card_id, v_current_balance;
    END IF;

    -- 2. Update Card
    UPDATE demo.loyalty_cards
    SET points_balance = points_balance + p_points_delta - (p_redeemed_delta * 10),
        total_free_coffees_redeemed = total_free_coffees_redeemed + p_redeemed_delta,
        last_updated = NOW()
    WHERE id = v_card_id;

    -- 3. Log Transaction
    INSERT INTO demo.loyalty_transactions (card_id, order_id, change_amount, transaction_type)
    VALUES (v_card_id, p_order_id, p_points_delta - (p_redeemed_delta * 10), 'adjustment');

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_current_balance + p_points_delta - (p_redeemed_delta * 10),
        'added_points', p_points_delta
    );
END;
$$;

-- Grant permissions for new functions
GRANT ALL ON ALL TABLES IN SCHEMA demo TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.get_loyalty_balance TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.handle_loyalty_purchase TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.handle_loyalty_cancellation TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.handle_loyalty_adjustment TO anon, authenticated, service_role;
