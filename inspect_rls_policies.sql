-- INSPECT RLS POLICIES
SELECT tablename, policyname, cmd, roles, qual 
FROM pg_policies 
WHERE tablename IN ('inventory_items', 'recipes', 'recipe_ingredients');
