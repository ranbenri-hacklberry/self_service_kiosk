-- RPC to securely delete a supplier order (and its items)
-- Handles cascade deletion manualy to avoid FK constraints, and bypasses RLS.

CREATE OR REPLACE FUNCTION delete_supplier_order(p_order_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete items first (Cascade)
  DELETE FROM supplier_order_items WHERE supplier_order_id = p_order_id;
  
  -- Delete parent order
  DELETE FROM supplier_orders WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_supplier_order(BIGINT) TO authenticated;
