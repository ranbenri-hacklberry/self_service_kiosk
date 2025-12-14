-- FIX: Add missing last_updated column
-- Run this in Supabase SQL Editor to fix the "Could not find the 'last_updated' column" error.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'last_updated') THEN
        ALTER TABLE inventory_items ADD COLUMN last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;
