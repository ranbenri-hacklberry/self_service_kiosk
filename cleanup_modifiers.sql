-- SQL Script to clean up incorrect modifier assignments
-- This removes coffee modifiers from non-drink items

-- First, let's see what we're dealing with
SELECT 
  'ITEMS WITH INCORRECT MODIFIERS' as section,
  mi.id,
  mi.name,
  mi.category,
  COUNT(DISTINCT io.group_id) as modifier_groups_count
FROM menu_items mi
JOIN item_options io ON mi.id = io.item_id
WHERE mi.category IN ('מאפים', 'סלטים', 'סלט', 'כריכים וטוסטים', 'כריכים', 'טוסטים', 'קינוחים', 'תוספות')
GROUP BY mi.id, mi.name, mi.category
ORDER BY mi.category, mi.name;

-- Show detailed view of what will be deleted
SELECT 
  'DETAILED VIEW OF MODIFIERS TO DELETE' as section,
  mi.name as item_name,
  mi.category,
  og.name as modifier_group,
  io.item_id,
  io.group_id
FROM menu_items mi
JOIN item_options io ON mi.id = io.item_id
JOIN option_groups og ON io.group_id = og.id
WHERE mi.category IN ('מאפים', 'סלטים', 'סלט', 'כריכים וטוסטים', 'כריכים', 'טוסטים', 'קינוחים', 'תוספות')
ORDER BY mi.category, mi.name, og.name;

-- UNCOMMENT THE FOLLOWING LINE TO ACTUALLY DELETE THE INCORRECT MODIFIERS:
-- DELETE FROM item_options 
-- WHERE item_id IN (
--   SELECT mi.id 
--   FROM menu_items mi
--   WHERE mi.category IN ('מאפים', 'סלטים', 'סלט', 'כריכים וטוסטים', 'כריכים', 'טוסטים', 'קינוחים', 'תוספות')
-- );

-- After deletion, verify the cleanup
-- SELECT 
--   'VERIFICATION - ITEMS THAT STILL HAVE MODIFIERS' as section,
--   mi.id,
--   mi.name,
--   mi.category,
--   COUNT(DISTINCT io.group_id) as modifier_groups_count
-- FROM menu_items mi
-- LEFT JOIN item_options io ON mi.id = io.item_id
-- WHERE mi.category IN ('מאפים', 'סלטים', 'סלט', 'כריכים וטוסטים', 'כריכים', 'טוסטים', 'קינוחים', 'תוספות')
-- AND io.group_id IS NOT NULL
-- GROUP BY mi.id, mi.name, mi.category;
