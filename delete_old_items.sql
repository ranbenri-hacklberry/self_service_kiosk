
-- Remove specific items from Menu Items if they have no dependencies
-- 'מאפה חמאה'
-- 'פפיון ריקוטה ותות' (Corrected name)

DELETE FROM menu_items WHERE name = 'מאפה חמאה';
DELETE FROM menu_items WHERE name = 'פפיון ריקוטה ותות';
