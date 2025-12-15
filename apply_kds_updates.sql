-- 1. Add missing columns if they don't exist
DO $$ 
BEGIN 
    -- Add is_refund column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_refund') THEN
        ALTER TABLE orders ADD COLUMN is_refund BOOLEAN DEFAULT false;
    END IF;

    -- Add refund_amount column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'refund_amount') THEN
        ALTER TABLE orders ADD COLUMN refund_amount NUMERIC DEFAULT 0;
    END IF;

    -- Add price column to order_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'price') THEN
        ALTER TABLE order_items ADD COLUMN price NUMERIC DEFAULT 0;
    END IF;

    -- Add notes column to order_items if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'notes') THEN
        ALTER TABLE order_items ADD COLUMN notes TEXT;
    END IF;
END $$;

-- 2. Update submit_order function to handle item_status from JSON
CREATE OR REPLACE FUNCTION submit_order(
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
    p_cancelled_items jsonb DEFAULT '[]'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id uuid;
    v_order_number text;
    v_total_amount numeric;
    v_item jsonb;
    v_order_status text;
BEGIN
    -- Calculate total
    SELECT COALESCE(SUM((item->>'price')::numeric * (item->>'quantity')::int), 0)
    INTO v_total_amount
    FROM jsonb_array_elements(p_items) AS item;

    -- Determine initial status
    -- Default to 'in_progress' so it appears on KDS list.
    -- Even if all items are delayed, the order exists.
    v_order_status := 'in_progress';

    IF edit_mode THEN
        v_order_id := order_id;
        UPDATE orders 
        SET total_amount = v_total_amount, is_paid = p_is_paid, payment_method = p_payment_method, is_refund = p_refund
        WHERE id = v_order_id
        RETURNING order_number INTO v_order_number;
        
        -- Handle cancelled items (if any logic needed, add here)
    ELSE
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
    END IF;

    -- Insert Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO order_items (
            order_id, menu_item_id, quantity, price, mods, item_status, notes
        ) VALUES (
            v_order_id,
            (v_item->>'item_id')::int,
            (v_item->>'quantity')::int,
            (v_item->>'price')::numeric,
            v_item->'mods', -- Using 'mods' key as sent by JS (check submit-order.js logic)
            COALESCE(v_item->>'item_status', 'in_progress'),
            v_item->>'notes'
        );
    END LOOP;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_number', v_order_number
    );
END;
$$;
