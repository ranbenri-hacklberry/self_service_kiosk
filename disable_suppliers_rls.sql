-- Disable RLS on suppliers table to make it public
ALTER TABLE suppliers DISABLE ROW LEVEL SECURITY;

-- Just in case, grant SELECT to authenticated/anon if needed (usually public by default if RLS off, but good practice)
GRANT SELECT ON suppliers TO authenticated;
GRANT SELECT ON suppliers TO service_role;
