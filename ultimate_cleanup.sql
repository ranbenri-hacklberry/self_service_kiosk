
-- THIS IS THE ULTIMATE CLEANUP SCRIPT
-- It deletes ALL versions of submit_order_v2 efficiently without syntax errors.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Iterate over every function named 'submit_order_v2' and drop it by its specific signature
    FOR r IN 
        SELECT oid::regprocedure::text as func_sig 
        FROM pg_proc 
        WHERE proname = 'submit_order_v2'
    LOOP
        RAISE NOTICE 'Dropping function: %', r.func_sig;
        EXECUTE 'DROP FUNCTION ' || r.func_sig || ' CASCADE';
    END LOOP;
END $$;

-- NOW RECREATE THE CORRECT FUNCTION
CREATE OR REPLACE FUNCTION public.submit_order_v2(
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
SET search_path = public
AS $func$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_total_amount numeric;
    v_item jsonb;
    v_order_status text;
    v_order_item_id_str text;
    v_remaining_items int;
    v_course_stage int;
    v_item_fired_at timestamptz;
BEGIN
    -- Total Amount
    IF p_final_total IS NOT NULL THEN
        v_total_amount := p_final_total;
    ELSE
        SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
    END IF;

    v_order_status := 'in_progress';

    -- Logic
    IF edit_mode THEN
        v_order_id := order_id;
        
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
        
        IF jsonb_array_length(p_cancelled_items) > 0 THEN
            UPDATE order_items
            SET item_status = 'cancelled'
            WHERE id IN (SELECT (item->>'id')::uuid FROM jsonb_array_elements(p_cancelled_items) AS item);
            
            SELECT COUNT(*) INTO v_remaining_items FROM order_items WHERE order_items.order_id = v_order_id AND item_status != 'cancelled';
            IF v_remaining_items = 0 THEN
                UPDATE orders SET order_status = 'cancelled' WHERE id = v_order_id;
            END IF;
        END IF;

    ELSE
        INSERT INTO orders (
            customer_id, customer_name, customer_phone, order_status, is_paid, payment_method, total_amount, is_refund, refund_amount
        ) VALUES (
            p_customer_id, p_customer_name, p_customer_phone, v_order_status, p_is_paid, p_payment_method, v_total_amount, p_refund, CASE WHEN p_refund THEN v_total_amount ELSE 0 END
        )
        RETURNING id, order_number INTO v_order_id, v_order_number;
        
        IF p_is_quick_order THEN
             UPDATE orders SET customer_name = '#' || v_order_number WHERE id = v_order_id;
        END IF;
    END IF;

    -- Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_order_item_id_str := v_item->>'order_item_id';
        v_course_stage := COALESCE((v_item->>'course_stage')::int, 1);
        IF v_course_stage = 2 THEN v_item_fired_at := NULL; ELSE v_item_fired_at := NOW(); END IF;

        IF v_order_item_id_str IS NOT NULL AND v_order_item_id_str != 'null' AND v_order_item_id_str != '' THEN
             UPDATE order_items
             SET 
                quantity = (v_item->>'quantity')::int,
                mods = v_item->'mods',
                notes = v_item->>'notes',
                price = (v_item->>'price')::numeric,
                course_stage = v_course_stage,
                item_status = CASE 
                    WHEN v_course_stage = 1 AND item_status = 'held' THEN 'in_progress'
                    WHEN v_course_stage = 2 THEN 'held'
                    ELSE item_status
                END,
                item_fired_at = CASE
                    WHEN v_course_stage = 1 AND item_fired_at IS NULL THEN NOW()
                    WHEN v_course_stage = 2 THEN NULL
                    ELSE item_fired_at
                END
             WHERE id = v_order_item_id_str::uuid;
        ELSE
            INSERT INTO order_items (
                order_id, menu_item_id, quantity, price, mods, item_status, notes, course_stage, item_fired_at
            ) VALUES (
                v_order_id,
                (v_item->>'item_id')::int,
                (v_item->>'quantity')::int,
                (v_item->>'price')::numeric,
                v_item->'mods',
                COALESCE(v_item->>'item_status', CASE WHEN v_course_stage = 2 THEN 'held' ELSE 'in_progress' END),
                v_item->>'notes',
                v_course_stage,
                v_item_fired_at
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object('order_id', v_order_id, 'order_number', v_order_number);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.submit_order_v2 TO anon, authenticated, service_role;
