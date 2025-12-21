-- =====================================================
-- Fix RLS DELETE Policy for menu_items
-- Run this in Supabase SQL Editor
-- =====================================================

-- Allow DELETE on menu_items (public access for now)
DROP POLICY IF EXISTS "Allow public delete" ON menu_items;
DROP POLICY IF EXISTS "menu_items_delete_policy" ON menu_items;

CREATE POLICY "Allow public delete access" ON menu_items
FOR DELETE USING (true);

-- Also fix UPDATE policy in case it's needed
DROP POLICY IF EXISTS "Allow public update" ON menu_items;
DROP POLICY IF EXISTS "menu_items_update_policy" ON menu_items;

CREATE POLICY "Allow public update access" ON menu_items
FOR UPDATE USING (true);

-- Fix INSERT policy too
DROP POLICY IF EXISTS "Allow public insert" ON menu_items;
DROP POLICY IF EXISTS "menu_items_insert_policy" ON menu_items;

CREATE POLICY "Allow public insert access" ON menu_items
FOR INSERT WITH CHECK (true);

-- Verification: Check all policies on menu_items
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'menu_items';
