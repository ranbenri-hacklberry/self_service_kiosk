-- RPC to Close Supplier Order AND Update Inventory
CREATE OR REPLACE FUNCTION close_supplier_order(p_order_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  -- 1. Loop through items in this order to update inventory
  FOR v_item IN 
    SELECT inventory_item_id, quantity 
    FROM supplier_order_items 
    WHERE supplier_order_id = p_order_id
  LOOP
    -- Update Stock: Add ordered quantity to current stock
    UPDATE inventory_items
    SET 
      current_stock = COALESCE(current_stock, 0) + v_item.quantity,
      last_updated = NOW()
    WHERE id = v_item.inventory_item_id;
  END LOOP;

  -- 2. Update Order Status
  UPDATE supplier_orders
  SET 
      status = 'received', 
      delivery_status = 'arrived', 
      delivered_at = NOW()
  WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION close_supplier_order(BIGINT) TO authenticated;
