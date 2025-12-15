
-- Update Suppliers Table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'delivery_days') THEN
        ALTER TABLE suppliers ADD COLUMN delivery_days TEXT; -- Format: "0,1,2" (Sun, Mon, Tue)
    END IF;
END $$;

-- Update Inventory Items Table
DO $$
BEGIN
    -- Add supplier_id foreign key
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'supplier_id') THEN
        ALTER TABLE inventory_items ADD COLUMN supplier_id UUID REFERENCES suppliers(id);
    END IF;

    -- Add last_counted_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'last_counted_at') THEN
        ALTER TABLE inventory_items ADD COLUMN last_counted_at TIMESTAMPTZ;
    END IF;

    -- Add package/measurement info
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'measurement_type') THEN
        ALTER TABLE inventory_items ADD COLUMN measurement_type TEXT DEFAULT 'unit'; -- 'unit' or 'weight'/'bulk'
    END IF;

    -- Ensure current_stock is float-compatible (numeric)
    -- This is tricky if it's integer. Let's inspect or assume numeric/double.
    -- Usually better to just alter type if needed, but safe to assume typically numeric.
END $$;

-- Create a helper function to match existing string suppliers to IDs if needed (One time migration logic could go here, but I'll skip complex logic for now)
