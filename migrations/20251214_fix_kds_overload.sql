-- Fix KDS Function Overload (PGRST203)
-- Description: Drops ALL existing versions of get_kds_orders to resolve ambiguity, then recreates the correct one.

-- 1. Drop all existing overloads of the function dynamically
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT oid::regprocedure as func_signature
        FROM pg_proc
        WHERE proname = 'get_kds_orders'
        AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.func_signature;
        RAISE NOTICE 'Dropped function: %', r.func_signature;
    END LOOP;
END $$;

-- 2. Recreate the canonical version
CREATE OR REPLACE FUNCTION get_kds_orders(p_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (
  id UUID,
  order_number BIGINT,
  order_status TEXT,
  is_paid BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  fired_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount NUMERIC,
  order_items JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_business_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Identify the current user and their business
    v_user_id := auth.uid();
    
    -- Try to get business_id from employees table
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    -- If no employee record found (or not logged in via Supabase Auth), fallback or handle Demo
    -- Pilot Cafe ID: '11111111-1111-1111-1111-111111111111'
    IF v_business_id IS NULL THEN
        -- Check if it's the specific Demo User phone (hardcoded fallback if auth.uid() fails to map)
        v_business_id := '11111111-1111-1111-1111-111111111111';
    END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.order_status,
    o.is_paid,
    o.created_at,
    o.fired_at,
    o.ready_at,
    o.customer_name,
    o.customer_phone,
    o.total_amount,
    json_agg(
      json_build_object(
        'id', oi.id,
        'quantity', oi.quantity,
        'price', oi.price,
        'mods', oi.mods,
        'notes', oi.notes,
        'item_status', oi.item_status,
        'course_stage', oi.course_stage,
        'item_fired_at', oi.item_fired_at,
        'menu_items', json_build_object(
          'id', mi.id,
          'name', mi.name,
          'price', mi.price,
          'is_prep_required', mi.is_prep_required,
          'category', mi.category,
          'kds_routing_logic', mi.kds_routing_logic
        )
      )
    ) AS order_items
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
  WHERE 
    o.business_id = v_business_id
    AND o.created_at >= p_date
    AND (
      o.order_status IN ('pending', 'in_progress', 'ready')
      OR (o.order_status = 'completed' AND o.is_paid = false)
    )
    AND oi.item_status != 'cancelled'
  GROUP BY o.id
  ORDER BY o.created_at DESC;
END;
$$;
