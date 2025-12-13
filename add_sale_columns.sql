DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'sale_price') THEN
        ALTER TABLE menu_items ADD COLUMN sale_price NUMERIC;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'sale_start_date') THEN
        ALTER TABLE menu_items ADD COLUMN sale_start_date TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'menu_items' AND column_name = 'sale_end_date') THEN
        ALTER TABLE menu_items ADD COLUMN sale_end_date TIMESTAMPTZ;
    END IF;
END $$;
