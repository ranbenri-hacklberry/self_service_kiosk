-- פונקציה להפעלת פריטים (הכן עכשיו) - גרסה 2
CREATE OR REPLACE FUNCTION fire_items_v2(p_order_id UUID, p_item_ids UUID[])
RETURNS VOID AS $$
BEGIN
  -- 1. עדכון סטטוס הפריטים ל-in_progress
  UPDATE order_items
  SET item_status = 'in_progress'
  WHERE id = ANY(p_item_ids);

  -- 2. עדכון סטטוס ההזמנה ל-in_progress (תמיד, כי עכשיו מכינים משהו)
  UPDATE orders
  SET order_status = 'in_progress'
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- פונקציה להשלמת חלק מהזמנה (נמסר) - גרסה 2
CREATE OR REPLACE FUNCTION complete_order_part_v2(p_order_id UUID, p_item_ids UUID[], p_keep_order_open BOOLEAN)
RETURNS VOID AS $$
BEGIN
  -- 1. עדכון הפריטים שנבחרו לסטטוס 'completed'
  UPDATE order_items
  SET item_status = 'completed'
  WHERE id = ANY(p_item_ids);

  -- 2. עדכון סטטוס ההזמנה
  IF p_keep_order_open THEN
    -- אם יש חלק מושהה, נחזיר את ההזמנה ל-in_progress
    UPDATE orders
    SET order_status = 'in_progress'
    WHERE id = p_order_id;
  ELSE
    -- אם הכל נמסר, סגור את ההזמנה
    UPDATE orders
    SET order_status = 'completed'
    WHERE id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;