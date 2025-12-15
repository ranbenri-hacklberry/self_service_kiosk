-- Update fire_items_v2 to intelligently manage order status
-- Never downgrades from ready to in_progress
CREATE OR REPLACE FUNCTION fire_items_v2(p_order_id UUID, p_item_ids UUID[])
RETURNS VOID AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Update only the specific items to in_progress
  UPDATE order_items
  SET item_status = 'in_progress'
  WHERE id = ANY(p_item_ids);

  -- Get current order status
  SELECT order_status INTO v_current_status
  FROM orders
  WHERE id = p_order_id;

  -- Only update order status if it's not already 'ready'
  -- This prevents downgrading a partially-ready order back to in_progress
  -- when firing delayed items
  IF v_current_status NOT IN ('ready', 'completed') THEN
    UPDATE orders
    SET order_status = 'in_progress'
    WHERE id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update complete_order_part_v2 to set completed_at timestamp
CREATE OR REPLACE FUNCTION complete_order_part_v2(p_order_id UUID, p_item_ids UUID[], p_keep_order_open BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE order_items
  SET item_status = 'completed'
  WHERE id = ANY(p_item_ids);

  IF p_keep_order_open THEN
    UPDATE orders
    SET order_status = 'in_progress'
    WHERE id = p_order_id;
  ELSE
    UPDATE orders
    SET order_status = 'completed',
        completed_at = NOW()
    WHERE id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
