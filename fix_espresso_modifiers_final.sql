-- Fix Espresso items - Keep only "קצר" and "ארוק", remove "(כפול)" from names
-- אספרסו קצר (ID: 10) and אספרסו כפול (ID: 11)
DO $$
DECLARE
    espresso_short_id INTEGER := 10;
    espresso_double_id INTEGER := 11;
    option_group_id UUID;
BEGIN
    RAISE NOTICE 'Processing Espresso items...';

    -- Process אספרסו קצר (ID: 10)
    RAISE NOTICE 'Processing אספרסו קצר (ID: %)...', espresso_short_id;
    
    FOR option_group_id IN 
        SELECT mio.group_id
        FROM menuitemoptions mio
        WHERE mio.item_id = espresso_short_id
    LOOP
        -- Delete all option values except "קצר" and "ארוק"
        DELETE FROM optionvalues
        WHERE group_id = option_group_id
        AND value_name NOT ILIKE '%קצר%'
        AND value_name NOT ILIKE '%ארוק%'
        AND value_name NOT ILIKE '%lungo%'
        AND value_name NOT ILIKE '%ristretto%';
        
        -- Remove "(כפול)" from remaining option names
        UPDATE optionvalues
        SET value_name = REPLACE(value_name, '(כפול)', '')
        WHERE group_id = option_group_id
        AND value_name LIKE '%(כפול)%';
        
        -- Trim whitespace
        UPDATE optionvalues
        SET value_name = TRIM(value_name)
        WHERE group_id = option_group_id;
    END LOOP;
    
    RAISE NOTICE 'Cleaned up אספרסו קצר modifiers';

    -- Process אספרסו כפול (ID: 11)
    RAISE NOTICE 'Processing אספרסו כפול (ID: %)...', espresso_double_id;
    
    FOR option_group_id IN 
        SELECT mio.group_id
        FROM menuitemoptions mio
        WHERE mio.item_id = espresso_double_id
    LOOP
        -- Delete all option values except "קצר" and "ארוק"
        DELETE FROM optionvalues
        WHERE group_id = option_group_id
        AND value_name NOT ILIKE '%קצר%'
        AND value_name NOT ILIKE '%ארוק%'
        AND value_name NOT ILIKE '%lungo%'
        AND value_name NOT ILIKE '%ristretto%';
        
        -- Remove "(כפול)" from remaining option names
        UPDATE optionvalues
        SET value_name = REPLACE(value_name, '(כפול)', '')
        WHERE group_id = option_group_id
        AND value_name LIKE '%(כפול)%';
        
        -- Trim whitespace
        UPDATE optionvalues
        SET value_name = TRIM(value_name)
        WHERE group_id = option_group_id;
    END LOOP;
    
    RAISE NOTICE 'Cleaned up אספרסו כפול modifiers';
END $$;

-- Verify the changes
SELECT 
    mi.name as item_name,
    og.name as group_name, -- Changed from group_name to name
    ov.value_name as option_name,
    ov.price_adjustment
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
JOIN optionvalues ov ON og.id = ov.group_id
WHERE mi.id IN (10, 11)
ORDER BY mi.name, og.name, ov.value_name;
