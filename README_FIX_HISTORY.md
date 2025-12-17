# Fixing KDS History View

To fix the 400 Error and empty history view, you need to create a new helper function in your database. This function allows the KDS to securely fetch completed orders.

**Please run the following SQL in your Supabase Dashboard SQL Editor:**

```sql
-- Create the KDS History RPC function
CREATE OR REPLACE FUNCTION get_kds_history_orders(p_start_date TIMESTAMP WITH TIME ZONE, p_end_date TIMESTAMP WITH TIME ZONE, p_business_id UUID DEFAULT NULL)
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
  paid_amount NUMERIC,
  order_items JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    o.paid_amount,
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
         'menu_items', (
            SELECT json_build_object(
                'id', mi.id,
                'name', mi.name,
                'price', mi.price,
                'is_prep_required', mi.is_prep_required,
                'category', mi.category,
                'kds_routing_logic', mi.kds_routing_logic
            ) FROM menu_items mi WHERE mi.id = oi.menu_item_id
         )
      )
    ) AS order_items
  FROM orders o
  JOIN order_items oi ON o.id = oi.order_id
  WHERE 
    o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND (p_business_id IS NULL OR o.business_id = p_business_id)
    AND o.order_status IN ('completed', 'cancelled')
  GROUP BY o.id
  ORDER BY o.created_at DESC;
END;
$$;
```

After running this, the KDS History view will work immediately.
