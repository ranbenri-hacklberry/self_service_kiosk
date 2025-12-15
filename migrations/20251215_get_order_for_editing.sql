-- RPC Function to get a single order for editing
-- Uses SECURITY DEFINER to bypass RLS (same approach as get_kds_orders)

DROP FUNCTION IF EXISTS get_order_for_editing(UUID);

CREATE OR REPLACE FUNCTION get_order_for_editing(p_order_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'order_status', o.order_status,
    'is_paid', o.is_paid,
    'paid_amount', o.paid_amount,
    'total_amount', o.total_amount,
    'created_at', o.created_at,
    'fired_at', o.fired_at,
    'ready_at', o.ready_at,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'business_id', o.business_id,
    'loyalty_discount', o.loyalty_discount,
    'loyalty_points_earned', o.loyalty_points_earned,
    'order_items', (
      SELECT COALESCE(json_agg(
        json_build_object(
          'id', oi.id,
          'order_id', oi.order_id,
          'menu_item_id', oi.menu_item_id,
          'quantity', oi.quantity,
          'price', oi.price,
          'mods', oi.mods,
          'notes', oi.notes,
          'item_status', oi.item_status,
          'course_stage', oi.course_stage,
          'item_fired_at', oi.item_fired_at,
          'is_delayed', oi.is_delayed,
          'menu_items', json_build_object(
            'id', mi.id,
            'name', mi.name,
            'price', mi.price,
            'category', mi.category,
            'image', mi.image,
            'is_prep_required', mi.is_prep_required,
            'kds_routing_logic', mi.kds_routing_logic
          )
        )
      ), '[]'::json)
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = o.id
    )
  ) INTO result
  FROM orders o
  WHERE o.id = p_order_id;

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_order_for_editing(UUID) TO authenticated;

-- Test query (run manually if needed):
-- SELECT get_order_for_editing('your-order-uuid-here');

