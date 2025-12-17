# Required Action: Fix Prep Duration in History

To fix the "Empty" or "-" preparation duration in KDS History, you MUST update the database helper function.
This update ensures checking `updated_at` time effectively if `ready_at` is missing for older orders.

### 1. Open Supabase Dashboard
Go to your Supabase project -> **SQL Editor**.

### 2. Run the following SQL
Copy and paste the code from `create_history_rpc.sql` (renamed to `get_kds_history_orders_v2`) or copy directly below:

```sql
-- FUNCTION: get_kds_history_orders_v2
DROP FUNCTION IF EXISTS get_kds_history_orders_v2;

CREATE OR REPLACE FUNCTION get_kds_history_orders_v2(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_business_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number BIGINT,
  order_status public.order_status,
  is_paid BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  fired_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
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
    o.updated_at,
    o.customer_name,
    o.customer_phone,
    o.total_amount,
    o.paid_amount,
    (
      SELECT json_agg(
        json_build_object(
          'id', oi.id,
          'quantity', oi.quantity,
          'item_status', oi.item_status,
          'price', oi.price,
          'mods', oi.mods,
          'notes', oi.notes,
          'menu_item', (
             SELECT json_build_object('id', mi.id, 'name', mi.name, 'price', mi.price)
             FROM menu_items mi WHERE mi.id = oi.menu_item_id
          )
        )
      )
      FROM order_items oi
      WHERE oi.order_id = o.id
    ) AS order_items
  FROM orders o
  WHERE o.created_at >= p_start_date
    AND o.created_at <= p_end_date
    AND (
      p_business_id IS NULL OR o.business_id = p_business_id
    )
    AND o.order_status IN ('completed', 'cancelled')
  ORDER BY o.created_at DESC;
END;
$$;
```

### 3. Verify
After running this script, refresh the KDS page. The preparation duration should now appear (if the order has a completion time).
