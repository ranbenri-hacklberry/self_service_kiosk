-- CHECK REMAINING TABLES FOR BUSINESS_ID
SELECT table_name, column_name 
FROM information_schema.columns 
WHERE column_name = 'business_id' 
  AND table_name IN ('orders', 'menu_items', 'recipes', 'employees', 'profiles')
ORDER BY table_name;

-- CHECK IF BUSINESS 1111... EXISTS
SELECT * FROM businesses WHERE id = '11111111-1111-1111-1111-111111111111';
