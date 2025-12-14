-- CORRECT IS_HOT_DRINK FLAGS
-- Objective: Ensure ALL coffee/hot drinks count towards loyalty.

-- 1. Fix entire categories that should always count
UPDATE menu_items
SET is_hot_drink = true
WHERE category IN ('קפה', 'שתיה חמה');

-- 2. Fix specific items that might be in other categories but count (Optional)
-- e.g. "Iced Coffee" is in "Cold Drinks" but counts.
-- Based on your list, "Iced Coffee" (22) is already true.
-- "Espresso Double" (11) was false -> will be fixed by step 1.

-- Verify the fix
SELECT id, name, category, is_hot_drink 
FROM menu_items 
WHERE category IN ('קפה', 'שתיה חמה')
ORDER BY name;
