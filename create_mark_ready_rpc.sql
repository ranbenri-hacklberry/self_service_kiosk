-- RPC to mark items as ready (similar to fire_items_v2)
CREATE OR REPLACE FUNCTION mark_items_ready_v2(
  p_order_id UUID,
  p_item_ids UUID[]
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Update item status to 'ready'
  UPDATE order_items
  SET 
    item_status = 'ready',
    updated_at = NOW()
  WHERE 
    order_id = p_order_id
    AND id = ANY(p_item_ids)
    AND item_status != 'cancelled';

  -- Update order ready_at timestamp if not set
  UPDATE orders
  SET 
    ready_at = COALESCE(ready_at, NOW()),
    updated_at = NOW()
  WHERE id = p_order_id;

  -- Check if ALL items are ready, then update order status
  IF NOT EXISTS (
    SELECT 1 FROM order_items 
    WHERE order_id = p_order_id 
    AND item_status NOT IN ('ready', 'cancelled', 'delivered', 'completed')
  ) THEN
    UPDATE orders
    SET 
      order_status = 'ready',
      updated_at = NOW()
    WHERE id = p_order_id;
  END IF;

  v_result := json_build_object(
    'success', true,
    'order_id', p_order_id,
    'items_updated', array_length(p_item_ids, 1)
  );

  RETURN v_result;
END;
$$;
