-- Add is_multiple_select and is_required columns to optiongroups table
-- These control whether a customer can select multiple options and whether selection is required

ALTER TABLE optiongroups 
ADD COLUMN IF NOT EXISTS is_multiple_select BOOLEAN DEFAULT FALSE;

ALTER TABLE optiongroups 
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT FALSE;

-- Update any existing records to have sensible defaults
UPDATE optiongroups SET is_multiple_select = FALSE WHERE is_multiple_select IS NULL;
UPDATE optiongroups SET is_required = FALSE WHERE is_required IS NULL;

SELECT 'optiongroups settings columns added successfully!' as status;

