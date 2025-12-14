-- VERIFY PRICE UPDATE AS PILOT USER
-- I will simulate being the user and try to update price.

-- 1. Switch to Pilot User Context (Simulated via RLS check)
-- Actually, I'll just run the UPDATE. The RLS check will happen if I was logged in.
-- But since I am running as Postgres Superuser here, I can't test RLS failure directly unless I impersonate.
-- Instead, I will check the policy strictness again.

-- Check if there are any triggers on menu_items?
SELECT tgname, tgfoid::regproc, tgrelid::regclass 
FROM pg_trigger
WHERE tgrelid = 'menu_items'::regclass;

-- Try to update explicitly to see if it works as Admin
UPDATE menu_items SET price = 35 WHERE id = 8 RETURNING id, price;
-- Revert it back
UPDATE menu_items SET price = 34 WHERE id = 8;
