-- Increment Inventory Stock (Safe Update)
CREATE OR REPLACE FUNCTION increment_stock(p_item_id BIGINT, p_delta NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE inventory_items
  SET current_stock = GREATEST(0, current_stock + p_delta),
      last_updated = NOW()
  WHERE id = p_item_id;
END;
$$;
