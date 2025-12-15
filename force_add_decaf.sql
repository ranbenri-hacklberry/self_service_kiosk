-- Force add "נטול קפאין" (Decaf) option to all hot drinks
-- SIMPLIFIED VERSION (No DO block, standard SQL only)

-- 1. Create Option Group if not exists
INSERT INTO optiongroups (name, is_required)
SELECT 'קפאין', false
WHERE NOT EXISTS (SELECT 1 FROM optiongroups WHERE name = 'קפאין');

-- 2. Create "Decaf" value if not exists
INSERT INTO optionvalues (group_id, value_name, price_adjustment, display_order)
SELECT id, 'נטול קפאין', 0, 1
FROM optiongroups WHERE name = 'קפאין'
AND NOT EXISTS (
    SELECT 1 FROM optionvalues 
    WHERE group_id = optiongroups.id AND value_name = 'נטול קפאין'
);

-- 3. Create "Regular" value if not exists
INSERT INTO optionvalues (group_id, value_name, price_adjustment, display_order, is_default)
SELECT id, 'רגיל', 0, 0, true
FROM optiongroups WHERE name = 'קפאין'
AND NOT EXISTS (
    SELECT 1 FROM optionvalues 
    WHERE group_id = optiongroups.id AND value_name = 'רגיל'
);

-- 4. Link to ALL items in relevant categories
INSERT INTO menuitemoptions (item_id, group_id)
SELECT m.id, g.id
FROM menu_items m, optiongroups g
WHERE g.name = 'קפאין'
AND (
    m.category IN ('hot-drinks', 'שתיה חמה', 'coffee', 'קפה')
    OR m.is_hot_drink = true
    OR m.name ILIKE '%הפוך%'
    OR m.name ILIKE '%קפוצ''ינו%'
    OR m.name ILIKE '%אספרסו%'
    OR m.name ILIKE '%אמריקנו%'
    OR m.name ILIKE '%נס%'
    OR m.name ILIKE '%שחור%'
)
AND NOT EXISTS (
    SELECT 1 FROM menuitemoptions mio 
    WHERE mio.item_id = m.id AND mio.group_id = g.id
);
