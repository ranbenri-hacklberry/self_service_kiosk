-- Force update of updated_at to ensure KDS picks up the change immediately
-- This is the FINAL fix for "invisible orders"

CREATE OR REPLACE FUNCTION submit_order_v2(
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
    -- Determine Total Amount
    IF p_final_total IS NOT NULL THEN
        v_total_amount := p_final_total;
    ELSE
        SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
    END IF;

    -- Determine initial status
    v_order_status := 'in_progress';

    IF edit_mode THEN
        v_order_id := order_id;
        
        -- Capture previous state
        SELECT is_paid INTO v_was_paid FROM orders WHERE id = v_order_id;
        
        -- Calculate old coffee count
        IF p_customer_id IS NOT NULL THEN
            IF p_original_coffee_count IS NOT NULL THEN
                v_old_coffee_count := p_original_coffee_count;
            ELSE
                SELECT COALESCE(SUM(oi.quantity), 0)
                INTO v_old_coffee_count
                FROM order_items oi
                JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = v_order_id
                  AND oi.item_status != 'cancelled'
                  AND mi.is_hot_drink = true;
            END IF;
        END IF;
        
        -- UPDATE ORDER - CRITICAL: Force updated_at to NOW()
        UPDATE orders 
        SET 
            total_amount = v_total_amount, 
            is_paid = p_is_paid, 
            payment_method = p_payment_method, 
            is_refund = p_refund,
            updated_at = NOW(), -- <--- CRITICAL FIX HERE
            refund_amount = CASE 
                WHEN p_refund AND original_total IS NOT NULL AND original_total > 0 
                THEN original_total - v_total_amount 
                ELSE 0 
            END
        WHERE id = v_order_id
        RETURNING order_number INTO v_order_number;
        
        -- 1. Handle cancelled items
        IF jsonb_array_length(p_cancelled_items) > 0 THEN
            UPDATE order_items
            SET item_status = 'cancelled'
            WHERE id IN (
                SELECT (item->>'id')::uuid
                FROM jsonb_array_elements(p_cancelled_items) AS item
            );
        END IF;

    ELSE
        -- NEW ORDER logic
        INSERT INTO orders (
            customer_id, customer_name, customer_phone, 
            order_status, is_paid, payment_method, total_amount, 
            is_refund, refund_amount
        ) VALUES (
            p_customer_id, p_customer_name, p_customer_phone,
            v_order_status, p_is_paid, p_payment_method, v_total_amount,
            p_refund, CASE WHEN p_refund THEN v_total_amount ELSE 0 END
        )
        RETURNING id, order_number INTO v_order_id, v_order_number;
        
        IF p_is_quick_order THEN
             UPDATE orders
             SET customer_name = '#' || v_order_number
             WHERE id = v_order_id;
        END IF;
    END IF;

    -- 2. Insert/Update Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_order_item_id_str := v_item->>'order_item_id';

        IF v_order_item_id_str IS NOT NULL AND v_order_item_id_str != 'null' AND v_order_item_id_str != '' THEN
             UPDATE order_items
             SET 
                quantity = (v_item->>'quantity')::int,
                mods = v_item->'mods',
                notes = v_item->>'notes',
                price = (v_item->>'price')::numeric
             WHERE id = v_order_item_id_str::uuid;
        ELSE
            -- New item
            INSERT INTO order_items (
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

    -- 3. FINAL CHECK: Only now check if the order is effectively cancelled
    IF edit_mode THEN
        SELECT COUNT(*)
        INTO v_remaining_items
        FROM order_items
        WHERE order_items.order_id = v_order_id
          AND item_status != 'cancelled';
        
        IF v_remaining_items = 0 THEN
            UPDATE orders
            SET order_status = 'cancelled'
            WHERE id = v_order_id;
        ELSE
            -- Restore active status if needed
            -- Also ensures updated_at is touched if we change status
            UPDATE orders
            SET order_status = CASE 
                WHEN order_status = 'cancelled' THEN 'in_progress' 
                ELSE order_status 
            END,
            updated_at = NOW() -- Double check ensure update
            WHERE id = v_order_id;
        END IF;
    END IF;

    -- Loyalty Logic
    IF p_customer_id IS NOT NULL THEN
        SELECT COALESCE(SUM(oi.quantity), 0)
        INTO v_new_coffee_count
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = v_order_id
          AND oi.item_status != 'cancelled'
          AND mi.is_hot_drink = true;

        IF p_is_paid THEN
            IF v_was_paid THEN
                v_loyalty_delta := v_new_coffee_count - v_old_coffee_count;
            ELSE
                v_loyalty_delta := v_new_coffee_count;
            END IF;
        ELSE
            IF v_was_paid THEN
                v_loyalty_delta := -v_old_coffee_count;
            ELSE
                v_loyalty_delta := 0;
            END IF;
        END IF;

        IF v_loyalty_delta != 0 THEN
            UPDATE customers
            SET loyalty_coffee_count = GREATEST(0, loyalty_coffee_count + v_loyalty_delta)
            WHERE id = p_customer_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number
    );
END;
$function$;
