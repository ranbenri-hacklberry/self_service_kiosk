-- Comprehensive Database Fix Script
-- Run this script to apply ALL necessary schema changes for the Modifier and Sales features.
-- It attempts to add columns IF they don't exist, so it's safe to run multiple times.

-- 1. Sales Features (menu_items)
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sale_start_time TIME;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS sale_end_time TIME;

-- 2. Modifier Categorization (optiongroups)
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT TRUE;
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS is_drink BOOLEAN DEFAULT TRUE;

-- 3. Private Modifier Groups (optiongroups)
-- Linked strictly to a menu item. Deleting the item deletes the group.
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE;

-- 4. Modifier Inventory Linkage (optionvalues)
ALTER TABLE optionvalues ADD COLUMN IF NOT EXISTS inventory_item_id INTEGER REFERENCES inventory_items(id);
ALTER TABLE optionvalues ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;

-- 5. Data Cleanup (Ensure defaults)
UPDATE optiongroups SET is_food = TRUE WHERE is_food IS NULL;
UPDATE optiongroups SET is_drink = TRUE WHERE is_drink IS NULL;
