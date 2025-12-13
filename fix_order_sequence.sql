-- Fix order number sequence to prevent duplicates

-- 1. Get the current max order_number
DO $$
DECLARE
  max_order_num bigint;
BEGIN
  SELECT COALESCE(MAX(order_number), 0) INTO max_order_num FROM orders;
  
  -- Reset sequence to max + 1
  PERFORM setval('order_number_seq', max_order_num + 1, false);
  
  RAISE NOTICE 'Order number sequence reset to: %', max_order_num + 1;
END $$;
