-- Query to check all menu items and their modifiers
-- Run this in Supabase SQL Editor

-- 1. Show all option groups
SELECT 
  'OPTION GROUPS' as section,
  id,
  name,
  created_at
FROM option_groups
ORDER BY name;

-- 2. Show all option values grouped by their group
SELECT 
  'OPTION VALUES' as section,
  og.name as group_name,
  ov.name as value_name,
  ov.is_default,
  ov.price_adjustment,
  ov.id as value_id,
  ov.group_id
FROM option_values ov
JOIN option_groups og ON ov.group_id = og.id
ORDER BY og.name, ov.name;

-- 3. Show all menu items with their assigned modifiers
SELECT 
  'MENU ITEMS WITH MODIFIERS' as section,
  mi.id as item_id,
  mi.name as item_name,
  mi.category,
  mi.is_hot_drink,
  og.name as modifier_group,
  COUNT(ov.id) as num_options
FROM menu_items mi
LEFT JOIN item_options io ON mi.id = io.item_id
LEFT JOIN option_groups og ON io.group_id = og.id
LEFT JOIN option_values ov ON ov.group_id = og.id
GROUP BY mi.id, mi.name, mi.category, mi.is_hot_drink, og.name
ORDER BY mi.category, mi.name, og.name;

-- 4. Find items with no modifiers
SELECT 
  'ITEMS WITHOUT MODIFIERS' as section,
  mi.id,
  mi.name,
  mi.category,
  mi.is_hot_drink
FROM menu_items mi
LEFT JOIN item_options io ON mi.id = io.item_id
WHERE io.item_id IS NULL
ORDER BY mi.category, mi.name;

-- 5. Show detailed item-modifier mapping
SELECT 
  'DETAILED MAPPING' as section,
  mi.name as item_name,
  mi.category,
  og.name as modifier_group,
  ov.name as option_value,
  ov.is_default,
  ov.price_adjustment
FROM menu_items mi
JOIN item_options io ON mi.id = io.item_id
JOIN option_groups og ON io.group_id = og.id
JOIN option_values ov ON ov.group_id = og.id
ORDER BY mi.category, mi.name, og.name, ov.name;
