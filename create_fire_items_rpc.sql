DROP FUNCTION IF EXISTS fire_items(UUID, BIGINT[]);

CREATE OR REPLACE FUNCTION fire_items(p_order_id UUID, p_item_ids UUID[])
RETURNS VOID AS $$
BEGIN
  -- 1. עדכון סטטוס הפריטים ל-in_progress
  UPDATE order_items
  SET item_status = 'in_progress'
  WHERE id = ANY(p_item_ids);

  -- 2. עדכון סטטוס ההזמנה ל-in_progress אם היא הייתה pending
  UPDATE orders
  SET order_status = 'in_progress'
  WHERE id = p_order_id AND order_status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;