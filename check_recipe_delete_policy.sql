-- VERIFY RECIPE DELETE POLICY
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename = 'recipe_ingredients';

-- SIMULATE DELETE (If I can find a row)
-- I won't delete real data blindly, just checking policy exists.
