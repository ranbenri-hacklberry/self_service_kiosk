-- Allow INSERTS for Master Catalog (Needed for Seeding)
-- Run this in Supabase SQL Editor

CREATE POLICY "Allow Insert Admin" ON public.master_categories FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow Update Admin" ON public.master_categories FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Allow Insert Admin" ON public.master_ingredients FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow Update Admin" ON public.master_ingredients FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Allow Insert Admin" ON public.master_suppliers FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow Update Admin" ON public.master_suppliers FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Allow Insert Admin" ON public.master_supplier_catalog FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow Update Admin" ON public.master_supplier_catalog FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Allow Insert Admin" ON public.master_option_groups FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow Update Admin" ON public.master_option_groups FOR UPDATE TO anon, authenticated USING (true);

CREATE POLICY "Allow Insert Admin" ON public.master_option_values FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow Update Admin" ON public.master_option_values FOR UPDATE TO anon, authenticated USING (true);
