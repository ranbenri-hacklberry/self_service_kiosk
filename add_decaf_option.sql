-- Add "נטול קפאין" (Decaf) option to all hot drinks
-- This script creates a caffeine option group and adds it to relevant items

-- Step 1: Check if caffeine option group exists, if not create it
DO $$
DECLARE
  v_caffeine_group_id UUID;
  v_decaf_value_id UUID;
  v_regular_value_id UUID;
BEGIN
  -- Check if caffeine group exists
  SELECT id INTO v_caffeine_group_id
  FROM option_groups
  WHERE name = 'קפאין'
  LIMIT 1;

  -- If not exists, create it
  IF v_caffeine_group_id IS NULL THEN
    INSERT INTO option_groups (name, display_order, is_required)
    VALUES ('קפאין', 100, false)
    RETURNING id INTO v_caffeine_group_id;
    
    RAISE NOTICE 'Created caffeine option group: %', v_caffeine_group_id;
  ELSE
    RAISE NOTICE 'Caffeine option group already exists: %', v_caffeine_group_id;
  END IF;

  -- Check if decaf value exists
  SELECT id INTO v_decaf_value_id
  FROM option_values
  WHERE group_id = v_caffeine_group_id
    AND name ILIKE '%נטול%'
  LIMIT 1;

  -- If not exists, create it
  IF v_decaf_value_id IS NULL THEN
    INSERT INTO option_values (group_id, name, price_adjustment, display_order)
    VALUES (v_caffeine_group_id, 'נטול קפאין', 0, 1)
    RETURNING id INTO v_decaf_value_id;
    
    RAISE NOTICE 'Created decaf option value: %', v_decaf_value_id;
  ELSE
    RAISE NOTICE 'Decaf option value already exists: %', v_decaf_value_id;
  END IF;

  -- Check if regular caffeine value exists
  SELECT id INTO v_regular_value_id
  FROM option_values
  WHERE group_id = v_caffeine_group_id
    AND (name ILIKE '%רגיל%' OR name = 'קפאין רגיל')
  LIMIT 1;

  -- If not exists, create it
  IF v_regular_value_id IS NULL THEN
    INSERT INTO option_values (group_id, name, price_adjustment, display_order, is_default)
    VALUES (v_caffeine_group_id, 'רגיל', 0, 0, true)
    RETURNING id INTO v_regular_value_id;
    
    RAISE NOTICE 'Created regular caffeine option value: %', v_regular_value_id;
  ELSE
    RAISE NOTICE 'Regular caffeine option value already exists: %', v_regular_value_id;
  END IF;

  -- Step 2: Link caffeine group to all hot drink items
  INSERT INTO menu_item_options (menu_item_id, option_group_id)
  SELECT DISTINCT mi.id, v_caffeine_group_id
  FROM menu_items mi
  WHERE mi.is_hot_drink = true
    AND mi.category IN ('שתיה חמה', 'hot-drinks')
    AND NOT EXISTS (
      SELECT 1 FROM menu_item_options mio
      WHERE mio.menu_item_id = mi.id
        AND mio.option_group_id = v_caffeine_group_id
    )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Linked caffeine options to hot drinks';
END $$;

-- Verify the changes
SELECT 
  og.name as group_name,
  ov.name as option_name,
  ov.price_adjustment,
  COUNT(DISTINCT mio.menu_item_id) as linked_items_count
FROM option_groups og
JOIN option_values ov ON ov.group_id = og.id
LEFT JOIN menu_item_options mio ON mio.option_group_id = og.id
WHERE og.name = 'קפאין'
GROUP BY og.name, ov.name, ov.price_adjustment
ORDER BY ov.display_order;
