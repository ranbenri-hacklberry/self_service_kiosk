-- ============================================================================
-- CLEANUP SCRIPT: Remove Coffee Modifiers from Non-Drink Items
-- ============================================================================
-- This script removes all modifier assignments from items that are NOT drinks
-- (pastries, salads, sandwiches, desserts, etc.)
--
-- INSTRUCTIONS:
-- 1. First, run the SELECT queries to see what will be affected
-- 2. Then, uncomment and run the DELETE statement to apply changes
-- ============================================================================

-- Step 1: View items that will be affected
-- ============================================================================
SELECT 
  '🔍 PREVIEW: Items with modifiers that will be removed' as info,
  mi.id,
  mi.name,
  mi.category,
  COUNT(DISTINCT io.group_id) as modifier_groups_count,
  STRING_AGG(DISTINCT og.name, ', ' ORDER BY og.name) as modifier_groups
FROM menu_items mi
JOIN item_options io ON mi.id = io.item_id
JOIN option_groups og ON io.group_id = og.id
WHERE mi.category IN (
  'מאפים',
  'סלטים', 
  'סלט',
  'כריכים וטוסטים',
  'כריכים וטוסט',
  'כריכים',
  'טוסטים',
  'קינוחים',
  'תוספות'
)
GROUP BY mi.id, mi.name, mi.category
ORDER BY mi.category, mi.name;

-- Step 2: Count how many assignments will be deleted
-- ============================================================================
SELECT 
  '📊 SUMMARY: Total modifier assignments to be removed' as info,
  COUNT(*) as total_assignments_to_delete
FROM item_options io
WHERE io.item_id IN (
  SELECT mi.id 
  FROM menu_items mi
  WHERE mi.category IN (
    'מאפים',
    'סלטים', 
    'סלט',
    'כריכים וטוסטים',
    'כריכים וטוסט',
    'כריכים',
    'טוסטים',
    'קינוחים',
    'תוספות'
  )
);

-- Step 3: APPLY THE CHANGES
-- ============================================================================
-- ⚠️  UNCOMMENT THE FOLLOWING LINES TO ACTUALLY DELETE THE MODIFIERS ⚠️
-- ============================================================================

-- BEGIN;

-- DELETE FROM item_options 
-- WHERE item_id IN (
--   SELECT mi.id 
--   FROM menu_items mi
--   WHERE mi.category IN (
--     'מאפים',
--     'סלטים', 
--     'סלט',
--     'כריכים וטוסטים',
--     'כריכים וטוסט',
--     'כריכים',
--     'טוסטים',
--     'קינוחים',
--     'תוספות'
--   )
-- );

-- COMMIT;

-- Step 4: Verify the cleanup (run after deletion)
-- ============================================================================
-- SELECT 
--   '✅ VERIFICATION: These items should have NO modifiers now' as info,
--   mi.id,
--   mi.name,
--   mi.category,
--   COUNT(io.group_id) as remaining_modifiers
-- FROM menu_items mi
-- LEFT JOIN item_options io ON mi.id = io.item_id
-- WHERE mi.category IN (
--   'מאפים',
--   'סלטים', 
--   'סלט',
--   'כריכים וטוסטים',
--   'כריכים וטוסט',
--   'כריכים',
--   'טוסטים',
--   'קינוחים',
--   'תוספות'
-- )
-- GROUP BY mi.id, mi.name, mi.category
-- HAVING COUNT(io.group_id) > 0
-- ORDER BY mi.category, mi.name;
