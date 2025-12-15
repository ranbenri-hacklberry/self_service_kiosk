-- Add missing time columns for sales
DO $$
BEGIN
    -- Add sale_start_time if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'sale_start_time') THEN
        ALTER TABLE menu_items ADD COLUMN sale_start_time TEXT;
    END IF;

    -- Add sale_end_time if not exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'sale_end_time') THEN
        ALTER TABLE menu_items ADD COLUMN sale_end_time TEXT;
    END IF;

    -- Ensure date columns are of type DATE (or TEXT) to avoid timezone confusion if we store time separately
    -- Note: Altering type might require casting if data exists.
    -- Assuming current data fits DATE format.
    -- ALTER TABLE menu_items ALTER COLUMN sale_start_date TYPE DATE USING sale_start_date::DATE;
    -- ALTER TABLE menu_items ALTER COLUMN sale_end_date TYPE DATE USING sale_end_date::DATE;
    
    -- For now, let's just make sure the time columns exist.
END $$;

-- Query to verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_items' 
AND column_name LIKE 'sale_%';
