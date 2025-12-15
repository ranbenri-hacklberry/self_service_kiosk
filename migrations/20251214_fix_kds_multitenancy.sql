-- Migration: Fix KDS Multi-Tenancy (2025-12-14)
-- Description: Updates get_kds_orders to properly filter by business_id and infer context for Demo users.

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
    
    -- Try to get business_id from employees table using auth_user_id
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE auth_user_id = v_user_id
    LIMIT 1;

    -- 2. Fallback: If not linked by ID, try matching by Phone Number (for Demo/Unlinked users)
    IF v_business_id IS NULL THEN
        -- Get phone from JWT or auth.users (Accessing auth.users requires checking permissions, but security definer handles it)
        -- We'll try to match employees.whatsapp_phone with the user's phone.
        -- Note: We trust the phone number because it's verified by Supabase Auth (OTP).
        BEGIN
            SELECT e.business_id INTO v_business_id
            FROM employees e
            JOIN auth.users u ON u.phone = e.whatsapp_phone
            WHERE u.id = v_user_id
            LIMIT 1;
        EXCEPTION WHEN OTHERS THEN
            v_business_id := NULL;
        END;
    END IF;

    -- 3. CRITICAL SECURITY FIX: Remove default fallback to Pilot.
    -- If we still don't know the business, we return NOTHING.
    IF v_business_id IS NULL THEN
        RETURN;
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
    o.business_id = v_business_id  -- <--- CRITICAL FIX: explicit filtering
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
