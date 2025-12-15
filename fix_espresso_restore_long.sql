-- Fix Espresso: Restore "ארוך" and remove duplicate group "זמני חליטה"
DO $$
DECLARE
    target_group_id UUID;
    v_item_id INTEGER; -- Changed variable name to avoid ambiguity
BEGIN
    -- Loop for both Espresso Short (10) and Double (11)
    FOR v_item_id IN SELECT unnest(ARRAY[10, 11])
    LOOP
        RAISE NOTICE 'Fixing item ID: %', v_item_id;

        -- 1. Identify the group we want to KEEP ("אורך משקה")
        SELECT og.id INTO target_group_id
        FROM menuitemoptions mio
        JOIN optiongroups og ON mio.group_id = og.id
        WHERE mio.item_id = v_item_id AND og.name = 'אורך משקה'
        LIMIT 1;

        -- If not found, try to find any group with 'קצר'
        IF target_group_id IS NULL THEN
            SELECT og.id INTO target_group_id
            FROM menuitemoptions mio
            JOIN optiongroups og ON mio.group_id = og.id
            JOIN optionvalues ov ON og.id = ov.group_id
            WHERE mio.item_id = v_item_id AND ov.value_name = 'קצר'
            LIMIT 1;
        END IF;

        IF target_group_id IS NOT NULL THEN
            RAISE NOTICE 'Target group ID: %', target_group_id;

            -- 2. Ensure "ארוך" exists in this group
            IF NOT EXISTS (SELECT 1 FROM optionvalues WHERE group_id = target_group_id AND value_name = 'ארוך') THEN
                INSERT INTO optionvalues (id, group_id, value_name, price_adjustment, display_order, is_default)
                VALUES (gen_random_uuid(), target_group_id, 'ארוך', 0, 2, false);
                RAISE NOTICE 'Restored "ארוך" option';
            END IF;
            
            -- Ensure "קצר" exists (it should, but just in case)
            IF NOT EXISTS (SELECT 1 FROM optionvalues WHERE group_id = target_group_id AND value_name = 'קצר') THEN
                INSERT INTO optionvalues (id, group_id, value_name, price_adjustment, display_order, is_default)
                VALUES (gen_random_uuid(), target_group_id, 'קצר', 0, 1, true);
                RAISE NOTICE 'Restored "קצר" option';
            END IF;

        END IF;

        -- 3. Remove the duplicate/unwanted group ("זמני חליטה") from this item
        DELETE FROM menuitemoptions
        WHERE item_id = v_item_id 
        AND group_id IN (SELECT id FROM optiongroups WHERE name = 'זמני חליטה');
        
        RAISE NOTICE 'Removed "זמני חליטה" group association';

    END LOOP;
END $$;

-- Verify final state
SELECT 
    mi.name as item_name,
    og.name as group_name,
    ov.value_name as option_name,
    ov.price_adjustment
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
JOIN optionvalues ov ON og.id = ov.group_id
WHERE mi.id IN (10, 11)
ORDER BY mi.name, og.name, ov.value_name;
