-- ============================================
-- MASTER FIX: Drop ALL versions and create clean ones
-- ============================================

-- Drop demo version with 14 args
DROP FUNCTION IF EXISTS demo.submit_order_v2(text, text, jsonb, boolean, uuid, text, boolean, boolean, uuid, numeric, boolean, jsonb, numeric, integer);

-- Drop public version with 15 args
DROP FUNCTION IF EXISTS public.submit_order_v2(text, text, jsonb, boolean, uuid, text, boolean, boolean, uuid, numeric, boolean, jsonb, numeric, integer, boolean);

-- Drop demo version with 15 args
DROP FUNCTION IF EXISTS demo.submit_order_v2(text, text, jsonb, boolean, uuid, text, boolean, boolean, uuid, numeric, boolean, jsonb, numeric, integer, boolean);

-- ============================================
-- CREATE PUBLIC VERSION (NO LOYALTY!)
-- ============================================
CREATE OR REPLACE FUNCTION public.submit_order_v2(
    p_customer_phone text DEFAULT NULL,
    p_customer_name text DEFAULT NULL,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_is_paid boolean DEFAULT false,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT NULL,
    p_refund boolean DEFAULT false,
    edit_mode boolean DEFAULT false,
    order_id uuid DEFAULT NULL,
    original_total numeric DEFAULT NULL,
    is_refund boolean DEFAULT false,
    p_cancelled_items jsonb DEFAULT '[]'::jsonb,
    p_final_total numeric DEFAULT NULL,
    p_original_coffee_count integer DEFAULT NULL,
    p_is_quick_order boolean DEFAULT false
)
RETURNS jsonb
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
    v_course_stage int;
    v_item_fired_at timestamptz;
BEGIN
    IF p_final_total IS NOT NULL THEN
        v_total_amount := p_final_total;
    ELSE
        SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
    END IF;

    v_order_status := 'in_progress';

    IF edit_mode THEN
        v_order_id := order_id;
        
        UPDATE public.orders 
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
            UPDATE public.order_items
            SET item_status = 'cancelled'
            WHERE id IN (
                SELECT (item->>'id')::uuid
                FROM jsonb_array_elements(p_cancelled_items) AS item
            );
            
            SELECT COUNT(*) INTO v_remaining_items
            FROM public.order_items
            WHERE public.order_items.order_id = v_order_id
              AND item_status != 'cancelled';
            
            IF v_remaining_items = 0 THEN
                UPDATE public.orders SET order_status = 'cancelled' WHERE id = v_order_id;
            END IF;
        END IF;

    ELSE
        INSERT INTO public.orders (
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
             UPDATE public.orders SET customer_name = '#' || v_order_number WHERE id = v_order_id;
        END IF;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_order_item_id_str := v_item->>'order_item_id';
        v_course_stage := COALESCE((v_item->>'course_stage')::int, 1);
        v_item_fired_at := CASE WHEN v_course_stage = 2 THEN NULL ELSE NOW() END;

        IF v_order_item_id_str IS NOT NULL AND v_order_item_id_str != 'null' AND v_order_item_id_str != '' THEN
             UPDATE public.order_items
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
            INSERT INTO public.order_items (
                order_id, menu_item_id, quantity, price, mods, item_status, notes,
                course_stage, item_fired_at
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

    -- *** NO LOYALTY CODE HERE - FRONTEND HANDLES IT! ***

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number
    );
END;
$function$;

-- ============================================
-- CREATE DEMO VERSION (NO LOYALTY!)
-- ============================================
CREATE OR REPLACE FUNCTION demo.submit_order_v2(
    p_customer_phone text DEFAULT NULL,
    p_customer_name text DEFAULT NULL,
    p_items jsonb DEFAULT '[]'::jsonb,
    p_is_paid boolean DEFAULT false,
    p_customer_id uuid DEFAULT NULL,
    p_payment_method text DEFAULT NULL,
    p_refund boolean DEFAULT false,
    edit_mode boolean DEFAULT false,
    order_id uuid DEFAULT NULL,
    original_total numeric DEFAULT NULL,
    is_refund boolean DEFAULT false,
    p_cancelled_items jsonb DEFAULT '[]'::jsonb,
    p_final_total numeric DEFAULT NULL,
    p_original_coffee_count integer DEFAULT NULL,
    p_is_quick_order boolean DEFAULT false
)
RETURNS jsonb
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
    v_course_stage int;
    v_item_fired_at timestamptz;
BEGIN
    IF p_final_total IS NOT NULL THEN
        v_total_amount := p_final_total;
    ELSE
        SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0)
        INTO v_total_amount
        FROM jsonb_array_elements(p_items) AS item;
    END IF;

    v_order_status := 'in_progress';

    IF edit_mode THEN
        v_order_id := order_id;
        
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
        
        IF jsonb_array_length(p_cancelled_items) > 0 THEN
            UPDATE demo.order_items
            SET item_status = 'cancelled'
            WHERE id IN (
                SELECT (item->>'id')::uuid
                FROM jsonb_array_elements(p_cancelled_items) AS item
            );
            
            SELECT COUNT(*) INTO v_remaining_items
            FROM demo.order_items
            WHERE demo.order_items.order_id = v_order_id
              AND item_status != 'cancelled';
            
            IF v_remaining_items = 0 THEN
                UPDATE demo.orders SET order_status = 'cancelled' WHERE id = v_order_id;
            END IF;
        END IF;

    ELSE
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
        
        IF p_is_quick_order THEN
             UPDATE demo.orders SET customer_name = '#' || v_order_number WHERE id = v_order_id;
        END IF;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_order_item_id_str := v_item->>'order_item_id';
        v_course_stage := COALESCE((v_item->>'course_stage')::int, 1);
        v_item_fired_at := CASE WHEN v_course_stage = 2 THEN NULL ELSE NOW() END;

        IF v_order_item_id_str IS NOT NULL AND v_order_item_id_str != 'null' AND v_order_item_id_str != '' THEN
             UPDATE demo.order_items
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
            INSERT INTO demo.order_items (
                order_id, menu_item_id, quantity, price, mods, item_status, notes,
                course_stage, item_fired_at
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

    -- *** NO LOYALTY CODE HERE - FRONTEND HANDLES IT! ***

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number
    );
END;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.submit_order_v2(text, text, jsonb, boolean, uuid, text, boolean, boolean, uuid, numeric, boolean, jsonb, numeric, integer, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION demo.submit_order_v2(text, text, jsonb, boolean, uuid, text, boolean, boolean, uuid, numeric, boolean, jsonb, numeric, integer, boolean) TO anon, authenticated, service_role;
