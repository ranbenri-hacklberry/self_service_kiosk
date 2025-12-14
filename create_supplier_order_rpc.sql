-- Create a secure function to handle order creation
-- This bypasses RLS issues by running as the database owner (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION create_supplier_order(
  p_business_id UUID,
  p_supplier_id BIGINT,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id BIGINT;
  v_item JSONB;
BEGIN
  -- Insert Order
  INSERT INTO supplier_orders (
    business_id, 
    supplier_id, 
    status, 
    delivery_status, 
    created_at
  )
  VALUES (
    p_business_id, 
    p_supplier_id, 
    'sent', 
    'pending', 
    NOW()
  )
  RETURNING id INTO v_order_id;

  -- Insert Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO supplier_order_items (
      supplier_order_id,
      inventory_item_id,
      quantity,
      ordered_quantity_units
    )
    VALUES (
      v_order_id,
      (v_item->>'itemId')::BIGINT,
      (v_item->>'qty')::NUMERIC,
      (v_item->>'qty')::NUMERIC
    );
  END LOOP;

  RETURN jsonb_build_object('id', v_order_id);
END;
$$;
