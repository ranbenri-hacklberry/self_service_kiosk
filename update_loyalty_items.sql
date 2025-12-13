-- Update specific items to be counted for loyalty (is_hot_drink = true)
-- IDs: 22, 23, 34, 56

-- 1. Update Public Schema
UPDATE public.menu_items
SET is_hot_drink = true
WHERE id IN (22, 23, 34, 56);

-- 2. Update Demo Schema
UPDATE demo.menu_items
SET is_hot_drink = true
WHERE id IN (22, 23, 34, 56);
