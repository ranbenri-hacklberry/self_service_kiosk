-- SECURITY FIX: Add is_super_admin column
-- Run this in Supabase SQL Editor

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'is_super_admin') THEN
        ALTER TABLE employees ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Allow reading this column (redundant if select * is granted, but good to be explicit)
GRANT SELECT ON employees TO anon, authenticated, service_role;
