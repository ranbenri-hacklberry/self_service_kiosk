
-- Function to clone a group and its values to a target item
CREATE OR REPLACE FUNCTION clone_group_to_item(source_group_id uuid, target_item_id int, new_group_name text)
RETURNS void AS $$
DECLARE
  new_group_id uuid;
BEGIN
  -- 1. Create new group
  INSERT INTO optiongroups (name, menu_item_id, is_required, is_multiple_select, is_food, is_drink, display_order, business_id)
  SELECT new_group_name, target_item_id, is_required, is_multiple_select, is_food, is_drink, display_order, business_id
  FROM optiongroups
  WHERE id = source_group_id
  RETURNING id INTO new_group_id;

  -- 2. Copy values
  INSERT INTO optionvalues (group_id, value_name, price_adjustment, is_default, display_order, inventory_item_id, business_id)
  SELECT new_group_id, value_name, price_adjustment, is_default, display_order, inventory_item_id, business_id
  FROM optionvalues
  WHERE group_id = source_group_id;

  -- 3. Link the new group to the item (and remove old links to avoid duplicates)
  DELETE FROM menuitemoptions WHERE item_id = target_item_id; -- Clean slate for these items
  INSERT INTO menuitemoptions (item_id, group_id) VALUES (target_item_id, new_group_id);

END;
$$ LANGUAGE plpgsql;

-- Execute the cloning for Item 8 and Item 9
-- Source Group: a7c44cf5-dc60-4944-abfa-d3d3f307e146 (Toast Options)

SELECT clone_group_to_item('a7c44cf5-dc60-4944-abfa-d3d3f307e146', 8, 'תוספות טוסט נקניק');
SELECT clone_group_to_item('a7c44cf5-dc60-4944-abfa-d3d3f307e146', 9, 'תוספת טוסט שחיתות');

-- Cleanup: Drop the helper function
DROP FUNCTION clone_group_to_item(uuid, int, text);
