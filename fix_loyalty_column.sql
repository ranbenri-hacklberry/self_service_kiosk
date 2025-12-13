-- Add total_coffees_purchased column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'total_coffees_purchased') THEN
        ALTER TABLE customers ADD COLUMN total_coffees_purchased INTEGER DEFAULT 0;
    END IF;
END $$;

-- Update handle_loyalty_purchase function to be robust
CREATE OR REPLACE FUNCTION handle_loyalty_purchase(
  p_phone TEXT,
  p_items_count INTEGER,
  p_is_refund BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_customer_id UUID;
  v_current_points INTEGER;
  v_new_points INTEGER;
  v_result JSON;
BEGIN
  -- Get customer ID
  SELECT id, loyalty_points INTO v_customer_id, v_current_points
  FROM customers
  WHERE phone_number = p_phone;

  IF v_customer_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Customer not found');
  END IF;

  -- Calculate new points
  IF p_is_refund THEN
    v_new_points := v_current_points - p_items_count;
    -- Ensure points don't go below 0
    IF v_new_points < 0 THEN v_new_points := 0; END IF;
    
    UPDATE customers
    SET 
      loyalty_points = v_new_points,
      total_coffees_purchased = GREATEST(0, COALESCE(total_coffees_purchased, 0) - p_items_count),
      updated_at = NOW()
    WHERE id = v_customer_id;
  ELSE
    v_new_points := v_current_points + p_items_count;
    
    UPDATE customers
    SET 
      loyalty_points = v_new_points,
      total_coffees_purchased = COALESCE(total_coffees_purchased, 0) + p_items_count,
      last_purchase_date = NOW(),
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'previous_points', v_current_points,
    'new_points', v_new_points,
    'customer_id', v_customer_id
  );
END;
$$;
