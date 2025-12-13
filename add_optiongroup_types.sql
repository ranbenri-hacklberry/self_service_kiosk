-- Add is_food and is_drink columns to optiongroups table
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS is_food BOOLEAN DEFAULT TRUE;
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS is_drink BOOLEAN DEFAULT TRUE;

-- Optional: You might want to update existing rows based on names, but for now we default to TRUE for both.
-- Example heuristic (uncomment if you want to be adventurous):
-- UPDATE optiongroups SET is_food = FALSE WHERE name LIKE '%Milk%' OR name LIKE '%Coffee%';
-- UPDATE optiongroups SET is_drink = FALSE WHERE name LIKE '%Sauce%' OR name LIKE '%Cheese%';
