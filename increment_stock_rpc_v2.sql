-- Increment Inventory Stock (Ensuring Public Access to RPC)
-- Sometimes RLS blocks RPC execution if function privileges aren't explicit.

CREATE OR REPLACE FUNCTION increment_stock(p_item_id BIGINT, p_delta NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inventory_items
  SET current_stock = GREATEST(0, current_stock + p_delta),
      last_updated = NOW()
  WHERE id = p_item_id;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_stock(BIGINT, NUMERIC) TO authenticated;
