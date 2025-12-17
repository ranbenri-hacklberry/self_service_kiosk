-- NUCLEAR OPTION: Open ALL permissions for Master Tables
-- Use this ONLY for initial seeding/setup.

-- 1. DROP ALL EXISTING POLICIES to be safe
DROP POLICY IF EXISTS "Allow Read All" ON public.master_categories;
DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_categories;
DROP POLICY IF EXISTS "Allow Update Admin" ON public.master_categories;

DROP POLICY IF EXISTS "Allow Read All" ON public.master_ingredients;
DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_ingredients;
DROP POLICY IF EXISTS "Allow Update Admin" ON public.master_ingredients;

DROP POLICY IF EXISTS "Allow Read All" ON public.master_suppliers;
DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_suppliers;
DROP POLICY IF EXISTS "Allow Update Admin" ON public.master_suppliers;

DROP POLICY IF EXISTS "Allow Read All" ON public.master_supplier_catalog;
DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_supplier_catalog;
DROP POLICY IF EXISTS "Allow Update Admin" ON public.master_supplier_catalog;

DROP POLICY IF EXISTS "Allow Read All" ON public.master_option_groups;
DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_option_groups;
DROP POLICY IF EXISTS "Allow Update Admin" ON public.master_option_groups;

DROP POLICY IF EXISTS "Allow Read All" ON public.master_option_values;
DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_option_values;
DROP POLICY IF EXISTS "Allow Update Admin" ON public.master_option_values;

-- 2. CREATE A SINGLE NUCLEAR POLICY FOR EACH
-- Allow everything (SELECT, INSERT, UPDATE, DELETE) for anon and authenticated users
CREATE POLICY "Nuclear Access" ON public.master_categories FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Nuclear Access" ON public.master_ingredients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Nuclear Access" ON public.master_suppliers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Nuclear Access" ON public.master_supplier_catalog FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Nuclear Access" ON public.master_option_groups FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Nuclear Access" ON public.master_option_values FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. ENSURE GRANTS (Redundant but safe)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
