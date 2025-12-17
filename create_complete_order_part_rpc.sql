DROP FUNCTION IF EXISTS complete_order_part(UUID, BIGINT[], BOOLEAN);

CREATE OR REPLACE FUNCTION complete_order_part(p_order_id UUID, p_item_ids UUID[], p_keep_order_open BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- 1. עדכון הפריטים שנבחרו לסטטוס 'completed'
  UPDATE order_items
  SET item_status = 'completed'
  WHERE id = ANY(p_item_ids);

  -- 2. עדכון סטטוס ההזמנה
  IF p_keep_order_open THEN
    -- אם יש חלק מושהה, נחזיר את ההזמנה ל-in_progress (או נשאיר אותה חיה)
    UPDATE orders
    SET order_status = 'in_progress',
        ready_at = COALESCE(ready_at, NOW())  -- Ensure ready_at is set
    WHERE id = p_order_id;
  ELSE
    -- אם הכל נמסר, סגור את ההזמנה
    UPDATE orders
    SET order_status = 'completed',
        ready_at = COALESCE(ready_at, NOW())  -- Ensure ready_at is set
    WHERE id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;