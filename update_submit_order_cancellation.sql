-- Drop the function first to avoid signature conflicts
DROP FUNCTION IF EXISTS submit_order_v2;

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
    -- DEBUG: Log incoming p_final_total
    RAISE NOTICE 'submit_order_v2: p_final_total received = %', p_final_total;
    
    -- Determine Total Amount
    IF p_final_total IS NOT NULL THEN
        v_total_amount := p_final_total;
        RAISE NOTICE 'submit_order_v2: Using p_final_total. v_total_amount = %', v_total_amount;
    ELSE
        -- Fallback: Calculate total from items
        SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
        RAISE NOTICE 'submit_order_v2: Calculated from items. v_total_amount = %', v_total_amount;
    END IF;

    -- Determine initial status
    v_order_status := 'in_progress';

    IF edit_mode THEN
        v_order_id := order_id;
        RAISE NOTICE 'submit_order_v2: EDIT MODE. Updating order % with total_amount = %', v_order_id, v_total_amount;
        
        -- Capture previous state for loyalty calculation
        SELECT is_paid INTO v_was_paid FROM orders WHERE id = v_order_id;
        
        -- Calculate old coffee count (only if customer exists)
        IF p_customer_id IS NOT NULL THEN
            IF p_original_coffee_count IS NOT NULL THEN
                v_old_coffee_count := p_original_coffee_count;
                RAISE NOTICE 'submit_order_v2: Using provided p_original_coffee_count = %', v_old_coffee_count;
            ELSE
                SELECT COALESCE(SUM(oi.quantity), 0)
                INTO v_old_coffee_count
                FROM order_items oi
                JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = v_order_id
                  AND oi.item_status != 'cancelled'
                  AND mi.is_hot_drink = true;
                RAISE NOTICE 'submit_order_v2: Calculated v_old_coffee_count from DB = %', v_old_coffee_count;
            END IF;
        END IF;
        
        UPDATE orders 
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
            UPDATE order_items
            SET item_status = 'cancelled'
            WHERE id IN (
                SELECT (item->>'id')::uuid
                FROM jsonb_array_elements(p_cancelled_items) AS item
            );
            
            -- Check if all items are now cancelled
            SELECT COUNT(*)
            INTO v_remaining_items
            FROM order_items
            WHERE order_items.order_id = v_order_id
              AND item_status != 'cancelled';
            
            -- If no items remain, mark order as cancelled
            IF v_remaining_items = 0 THEN
                UPDATE orders
                SET order_status = 'cancelled'
                WHERE id = v_order_id;
                RAISE NOTICE 'submit_order_v2: All items cancelled, marking order as cancelled';
            END IF;
        END IF;

    ELSE
        RAISE NOTICE 'submit_order_v2: NEW ORDER. Creating with total_amount = %', v_total_amount;
        
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
        
        -- Quick Order Logic: Update customer name to be the order number
        IF p_is_quick_order THEN
             UPDATE orders
             SET customer_name = '#' || v_order_number
             WHERE id = v_order_id;
             RAISE NOTICE 'submit_order_v2: Quick Order detected. Updated customer_name to #%', v_order_number;
        END IF;
        
        RAISE NOTICE 'submit_order_v2: Order created. ID = %, Number = %', v_order_id, v_order_number;
    END IF;

    -- Insert/Update Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        -- Extract order_item_id safely
        v_order_item_id_str := v_item->>'order_item_id';

        -- If item has an order_item_id (UUID), it's an update to an existing item
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

    -- Loyalty Calculation Logic
    IF p_customer_id IS NOT NULL THEN
        -- Calculate new coffee count
        SELECT COALESCE(SUM(oi.quantity), 0)
        INTO v_new_coffee_count
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
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
            UPDATE customers
            SET loyalty_coffee_count = GREATEST(0, loyalty_coffee_count + v_loyalty_delta)
            WHERE id = p_customer_id;
            
            RAISE NOTICE 'submit_order_v2: Updated loyalty for customer % by % points (Old=%, New=%)', 
                p_customer_id, v_loyalty_delta, v_old_coffee_count, v_new_coffee_count;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number
    );
END;
$function$;
