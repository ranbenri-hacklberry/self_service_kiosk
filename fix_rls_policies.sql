-- =====================================================
-- Fix RLS Policies for Multi-Tenant Access
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Fix menu_items table
DROP POLICY IF EXISTS "Allow public read" ON menu_items;
DROP POLICY IF EXISTS "menu_items_select_policy" ON menu_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON menu_items;

CREATE POLICY "Allow public read access" ON menu_items
FOR SELECT USING (true);

-- 2. Fix optiongroups table
DROP POLICY IF EXISTS "Allow public read" ON optiongroups;
DROP POLICY IF EXISTS "optiongroups_select_policy" ON optiongroups;
DROP POLICY IF EXISTS "Enable read access for all users" ON optiongroups;

CREATE POLICY "Allow public read access" ON optiongroups
FOR SELECT USING (true);

-- 3. Fix optionvalues table
DROP POLICY IF EXISTS "Allow public read" ON optionvalues;
DROP POLICY IF EXISTS "optionvalues_select_policy" ON optionvalues;
DROP POLICY IF EXISTS "Enable read access for all users" ON optionvalues;

CREATE POLICY "Allow public read access" ON optionvalues
FOR SELECT USING (true);

-- 4. Fix menuitemoptions table (junction table)
DROP POLICY IF EXISTS "Allow public read" ON menuitemoptions;
DROP POLICY IF EXISTS "menuitemoptions_select_policy" ON menuitemoptions;

CREATE POLICY "Allow public read access" ON menuitemoptions
FOR SELECT USING (true);

-- 5. Verification Query
SELECT 
    'menu_items' as table_name, 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE business_id = '22222222-2222-2222-2222-222222222222') as demo_items
FROM menu_items;
