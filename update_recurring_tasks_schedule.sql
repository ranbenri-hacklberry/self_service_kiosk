-- Add weekly schedule support to recurring_tasks
ALTER TABLE recurring_tasks 
ADD COLUMN IF NOT EXISTS weekly_schedule JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS logic_type TEXT DEFAULT 'fixed'; -- 'fixed' (Create X) or 'par_level' (Fill to X)

-- Comment on columns
COMMENT ON COLUMN recurring_tasks.weekly_schedule IS 'Map of day index (0-6) to configuration like { "qty": 10, "mode": "par_level" }';
