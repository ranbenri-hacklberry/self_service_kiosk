-- CHECK IS_HOT_DRINK STATUS
SELECT id, name, category, is_hot_drink, price
FROM menu_items
WHERE is_hidden = false
ORDER BY category, name;
