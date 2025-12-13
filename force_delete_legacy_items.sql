
-- Force delete legacy items by cleaning up their single/few historical records first

-- 1. "פפיון ריקוטה ותות" (ID 36) - Found 1 historical order
DELETE FROM order_items WHERE menu_item_id = 36;
DELETE FROM menu_items WHERE id = 36;

-- 2. "מאפה חמאה" (ID 33) - Found 0 historical orders (Safe)
DELETE FROM menu_items WHERE id = 33; 
-- Or by name to be sure
DELETE FROM menu_items WHERE name = 'מאפה חמאה';
