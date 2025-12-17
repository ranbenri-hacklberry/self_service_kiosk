-- Comprehensive Permission Fix for Master Catalog
-- Run this in Supabase SQL Editor

-- 1. Grant Usage on Schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Grant ALL Access to Tables (for Seeding)
GRANT ALL ON TABLE public.master_categories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_ingredients TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_suppliers TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_supplier_catalog TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_option_groups TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_option_values TO anon, authenticated, service_role;

-- 3. Ensure Sequences are accessible (for Serial IDs if any, though we used UUIDs)
-- Just in case:
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Re-apply Policies (Forcefully Open)
DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_categories;
CREATE POLICY "Allow Insert Admin" ON public.master_categories FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_ingredients;
CREATE POLICY "Allow Insert Admin" ON public.master_ingredients FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_suppliers;
CREATE POLICY "Allow Insert Admin" ON public.master_suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_supplier_catalog;
CREATE POLICY "Allow Insert Admin" ON public.master_supplier_catalog FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_option_groups;
CREATE POLICY "Allow Insert Admin" ON public.master_option_groups FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Insert Admin" ON public.master_option_values;
CREATE POLICY "Allow Insert Admin" ON public.master_option_values FOR INSERT TO anon, authenticated WITH CHECK (true);
