-- Fix Espresso items - Keep only "קצר" and "ארוק", remove "(כפול)" from names
DO $$
DECLARE
    espresso_id UUID;
    espresso_double_id UUID;
    option_group_id UUID;
BEGIN
    -- Get Espresso item IDs
    SELECT id INTO espresso_id
    FROM menu_items
    WHERE name = 'אספרסו'
    LIMIT 1;
    
    SELECT id INTO espresso_double_id
    FROM menu_items
    WHERE name ILIKE '%אספרסו%כפול%' OR name ILIKE '%אספרסו%דופיו%'
    LIMIT 1;

    RAISE NOTICE 'Espresso ID: %, Espresso Double ID: %', espresso_id, espresso_double_id;

    -- Process regular Espresso
    IF espresso_id IS NOT NULL THEN
        RAISE NOTICE 'Processing regular Espresso...';
        
        -- Get all option groups for this item
        FOR option_group_id IN 
            SELECT og.id
            FROM item_option_groups iog
            JOIN option_groups og ON iog.option_group_id = og.id
            WHERE iog.item_id = espresso_id
        LOOP
            -- Delete all option values except "קצר" and "ארוק"
            DELETE FROM option_group_values
            WHERE option_group_id = option_group_id
            AND name NOT ILIKE '%קצר%'
            AND name NOT ILIKE '%ארוק%'
            AND name NOT ILIKE '%lungo%'
            AND name NOT ILIKE '%ristretto%';
            
            -- Remove "(כפול)" from remaining option names
            UPDATE option_group_values
            SET name = REPLACE(name, '(כפול)', '')
            WHERE option_group_id = option_group_id
            AND name LIKE '%(כפול)%';
            
            -- Trim whitespace
            UPDATE option_group_values
            SET name = TRIM(name)
            WHERE option_group_id = option_group_id;
        END LOOP;
        
        RAISE NOTICE 'Cleaned up regular Espresso modifiers';
    END IF;

    -- Process Espresso Double
    IF espresso_double_id IS NOT NULL THEN
        RAISE NOTICE 'Processing Espresso Double...';
        
        -- Get all option groups for this item
        FOR option_group_id IN 
            SELECT og.id
            FROM item_option_groups iog
            JOIN option_groups og ON iog.option_group_id = og.id
            WHERE iog.item_id = espresso_double_id
        LOOP
            -- Delete all option values except "קצר" and "ארוק"
            DELETE FROM option_group_values
            WHERE option_group_id = option_group_id
            AND name NOT ILIKE '%קצר%'
            AND name NOT ILIKE '%ארוק%'
            AND name NOT ILIKE '%lungo%'
            AND name NOT ILIKE '%ristretto%';
            
            -- Remove "(כפול)" from remaining option names
            UPDATE option_group_values
            SET name = REPLACE(name, '(כפול)', '')
            WHERE option_group_id = option_group_id
            AND name LIKE '%(כפול)%';
            
            -- Trim whitespace
            UPDATE option_group_values
            SET name = TRIM(name)
            WHERE option_group_id = option_group_id;
        END LOOP;
        
        RAISE NOTICE 'Cleaned up Espresso Double modifiers';
    END IF;
END $$;

-- Verify the changes
SELECT 
    mi.name as item_name,
    og.name as group_name,
    ogv.name as option_name,
    ogv.price_adjustment
FROM menu_items mi
JOIN item_option_groups iog ON mi.id = iog.item_id
JOIN option_groups og ON iog.option_group_id = og.id
JOIN option_group_values ogv ON og.id = ogv.option_group_id
WHERE mi.name ILIKE '%אספרסו%'
ORDER BY mi.name, og.name, ogv.name;
