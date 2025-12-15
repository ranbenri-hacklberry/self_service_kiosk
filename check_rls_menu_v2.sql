-- CHECK RLS FOR MENU AND OPTIONS
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies 
WHERE tablename IN ('menu_items', 'optiongroups', 'optionvalues');
