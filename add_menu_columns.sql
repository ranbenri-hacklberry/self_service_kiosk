-- Add description column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'description') THEN
        ALTER TABLE menu_items ADD COLUMN description TEXT;
    END IF;
END $$;

-- Add is_in_stock column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'is_in_stock') THEN
        ALTER TABLE menu_items ADD COLUMN is_in_stock BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
