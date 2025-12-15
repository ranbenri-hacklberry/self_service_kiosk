-- Inspect Schema for Business ID and RLS Policies
-- Check columns for business_id
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('inventory_items', 'menu_items', 'orders', 'optiongroups', 'optionvalues', 'recipe_ingredients', 'employees', 'business_profiles')
AND column_name = 'business_id'
ORDER BY table_name;

-- Check existing RLS policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('inventory_items', 'menu_items', 'orders', 'optiongroups', 'optionvalues', 'recipe_ingredients', 'employees');

-- Check if tables have RLS enabled
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname IN ('inventory_items', 'menu_items', 'orders', 'optiongroups', 'optionvalues', 'recipe_ingredients', 'employees');
