-- 1. Link existing Pizza toppings to other pizzas (Public)
INSERT INTO public.menuitemoptions (item_id, group_id)
VALUES 
(54, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1'), -- Pizza White
(55, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1')  -- Pizza Pesto
ON CONFLICT DO NOTHING;

-- 2. Create new group for Toast and link (Public)
DO $$
DECLARE
    new_group_id uuid;
    source_group_id uuid := '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1';
BEGIN
    -- Create Group
    INSERT INTO public.optiongroups (name, is_required, is_multiple_select, display_order)
    VALUES ('תוספות לטוסט', false, true, 1)
    RETURNING id INTO new_group_id;

    -- Copy Values with new price (3)
    INSERT INTO public.optionvalues (group_id, value_name, price_adjustment, display_order, is_default)
    SELECT new_group_id, value_name, 3, display_order, is_default
    FROM public.optionvalues
    WHERE group_id = source_group_id;

    -- Link to Toasts
    INSERT INTO public.menuitemoptions (item_id, group_id)
    VALUES 
    (7, new_group_id), -- Toast Simple
    (8, new_group_id), -- Toast Pesto
    (9, new_group_id); -- Toast Alfredo
END $$;

-- 3. Link existing Pizza toppings to other pizzas (Demo)
INSERT INTO demo.menuitemoptions (item_id, group_id)
VALUES 
(54, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1'), -- Pizza White
(55, '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1')  -- Pizza Pesto
ON CONFLICT DO NOTHING;

-- 4. Create new group for Toast and link (Demo)
DO $$
DECLARE
    new_group_id uuid;
    source_group_id uuid := '2f9f4c7b-2919-43d1-a265-c7f2e3dcabe1';
BEGIN
    -- Create Group
    INSERT INTO demo.optiongroups (name, is_required, is_multiple_select, display_order)
    VALUES ('תוספות לטוסט', false, true, 1)
    RETURNING id INTO new_group_id;

    -- Copy Values with new price (3)
    INSERT INTO demo.optionvalues (group_id, value_name, price_adjustment, display_order, is_default)
    SELECT new_group_id, value_name, 3, display_order, is_default
    FROM demo.optionvalues
    WHERE group_id = source_group_id;

    -- Link to Toasts
    INSERT INTO demo.menuitemoptions (item_id, group_id)
    VALUES 
    (7, new_group_id), -- Toast Simple
    (8, new_group_id), -- Toast Pesto
    (9, new_group_id); -- Toast Alfredo
END $$;
