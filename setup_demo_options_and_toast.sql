-- Setup Demo Options Tables and Add Toast Toppings

-- 1. Create missing tables in Demo schema (cloning structure from Public)
CREATE TABLE IF NOT EXISTS demo.optiongroups (LIKE public.optiongroups INCLUDING ALL);
CREATE TABLE IF NOT EXISTS demo.optionvalues (LIKE public.optionvalues INCLUDING ALL);
CREATE TABLE IF NOT EXISTS demo.menuitemoptions (LIKE public.menuitemoptions INCLUDING ALL);

-- 2. Populate Demo tables with initial data from Public (if empty)
INSERT INTO demo.optiongroups SELECT * FROM public.optiongroups ON CONFLICT DO NOTHING;
INSERT INTO demo.optionvalues SELECT * FROM public.optionvalues ON CONFLICT DO NOTHING;
INSERT INTO demo.menuitemoptions SELECT * FROM public.menuitemoptions ON CONFLICT DO NOTHING;

-- 3. Link existing Pizza toppings to other pizzas (Public)
INSERT INTO public.menuitemoptions (item_id, group_id)
VALUES 
(54, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1'), -- Pizza White
(55, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1')  -- Pizza Pesto
ON CONFLICT DO NOTHING;

-- 4. Create new group for Toast and link (Public)
DO $$
DECLARE
    new_group_id uuid;
    source_group_id uuid := '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1';
BEGIN
    -- Check if group already exists to avoid duplicates
    SELECT id INTO new_group_id FROM public.optiongroups WHERE name = 'תוספות לטוסט' LIMIT 1;
    
    IF new_group_id IS NULL THEN
        -- Create Group
        INSERT INTO public.optiongroups (name, is_required, is_multiple_select, display_order)
        VALUES ('תוספות לטוסט', false, true, 1)
        RETURNING id INTO new_group_id;

        -- Copy Values with new price (3)
        INSERT INTO public.optionvalues (group_id, value_name, price_adjustment, display_order, is_default)
        SELECT new_group_id, value_name, 3, display_order, is_default
        FROM public.optionvalues
        WHERE group_id = source_group_id;
    END IF;

    -- Link to Toasts
    INSERT INTO public.menuitemoptions (item_id, group_id)
    VALUES 
    (7, new_group_id), -- Toast Simple
    (8, new_group_id), -- Toast Pesto
    (9, new_group_id)  -- Toast Alfredo
    ON CONFLICT DO NOTHING;
END $$;

-- 5. Sync changes to Demo (Link Pizza & Create Toast Group)
-- Link Pizza
INSERT INTO demo.menuitemoptions (item_id, group_id)
VALUES 
(54, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1'), -- Pizza White
(55, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1')  -- Pizza Pesto
ON CONFLICT DO NOTHING;

-- Create Toast Group in Demo
DO $$
DECLARE
    new_group_id uuid;
    source_group_id uuid := '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1';
BEGIN
    -- Check if group already exists
    SELECT id INTO new_group_id FROM demo.optiongroups WHERE name = 'תוספות לטוסט' LIMIT 1;

    IF new_group_id IS NULL THEN
        -- Create Group
        INSERT INTO demo.optiongroups (name, is_required, is_multiple_select, display_order)
        VALUES ('תוספות לטוסט', false, true, 1)
        RETURNING id INTO new_group_id;

        -- Copy Values with new price (3)
        INSERT INTO demo.optionvalues (group_id, value_name, price_adjustment, display_order, is_default)
        SELECT new_group_id, value_name, 3, display_order, is_default
        FROM demo.optionvalues
        WHERE group_id = source_group_id;
    END IF;

    -- Link to Toasts
    INSERT INTO demo.menuitemoptions (item_id, group_id)
    VALUES 
    (7, new_group_id), -- Toast Simple
    (8, new_group_id), -- Toast Pesto
    (9, new_group_id)  -- Toast Alfredo
    ON CONFLICT DO NOTHING;
END $$;
