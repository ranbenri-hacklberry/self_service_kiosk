-- Fix Nes Shahor (Black Coffee) - Remove all modifiers
-- Step 1: Find the item ID for Nes Shahor
DO $$
DECLARE
    nes_shahor_id UUID;
BEGIN
    -- Get Nes Shahor item ID
    SELECT id INTO nes_shahor_id
    FROM menu_items
    WHERE name ILIKE '%נס שחור%' OR name ILIKE '%קפה שחור%'
    LIMIT 1;

    IF nes_shahor_id IS NOT NULL THEN
        RAISE NOTICE 'Found Nes Shahor with ID: %', nes_shahor_id;
        
        -- Delete all item_option_groups for this item
        DELETE FROM item_option_groups
        WHERE item_id = nes_shahor_id;
        
        RAISE NOTICE 'Deleted all modifiers for Nes Shahor';
    ELSE
        RAISE NOTICE 'Nes Shahor not found';
    END IF;
END $$;

-- Verify
SELECT 
    mi.name as item_name,
    COUNT(iog.id) as modifier_count
FROM menu_items mi
LEFT JOIN item_option_groups iog ON mi.id = iog.item_id
WHERE mi.name ILIKE '%נס שחור%' OR mi.name ILIKE '%קפה שחור%'
GROUP BY mi.id, mi.name;
