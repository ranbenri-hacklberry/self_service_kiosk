ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS quantity_step numeric;
COMMENT ON COLUMN inventory_items.quantity_step IS 'Step size for quantity adjustments (e.g. 0.01 for 10g if kg, 1 for units)';
