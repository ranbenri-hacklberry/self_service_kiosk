-- 1. Add is_food and is_drink columns to optiongroups table first
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT TRUE;
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS is_drink BOOLEAN DEFAULT TRUE;

-- 2. Add inventory linkage to optionvalues with correct type (INTEGER)
ALTER TABLE optionvalues ADD COLUMN IF NOT EXISTS inventory_item_id INTEGER REFERENCES inventory_items(id);
ALTER TABLE optionvalues ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;

-- 3. Ensure is_food/is_drink are set on existing groups if they were null
UPDATE optiongroups SET is_food = TRUE WHERE is_food IS NULL;
UPDATE optiongroups SET is_drink = TRUE WHERE is_drink IS NULL;
