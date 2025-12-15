-- Fix "קפה שחור" (Black Coffee) - Remove all modifiers
-- Item ID: 20
DO $$
DECLARE
    coffee_id INTEGER := 20;
BEGIN
    RAISE NOTICE 'Processing קפה שחור (ID: %)...', coffee_id;
    
    -- Delete all menuitemoptions for this item
    DELETE FROM menuitemoptions
    WHERE item_id = coffee_id;
    
    RAISE NOTICE 'Deleted all modifiers for קפה שחור';
END $$;

-- Verify
SELECT 
    mi.name as item_name,
    COUNT(mio.item_id) as modifier_count
FROM menu_items mi
LEFT JOIN menuitemoptions mio ON mi.id = mio.item_id
WHERE mi.id = 20
GROUP BY mi.id, mi.name;
