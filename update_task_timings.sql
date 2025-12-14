-- Add task timing configuration to businesses
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS opening_tasks_start_time TIME WITHOUT TIME ZONE DEFAULT '07:30',
ADD COLUMN IF NOT EXISTS closing_tasks_start_time TIME WITHOUT TIME ZONE DEFAULT '15:00',
ADD COLUMN IF NOT EXISTS operating_hours JSONB;

-- Add pre-closing flag to recurring_tasks
ALTER TABLE public.recurring_tasks
ADD COLUMN IF NOT EXISTS is_pre_closing BOOLEAN DEFAULT false;

-- Update the specific pilot business if known, otherwise this is a general update
-- We will update based on current user context dynamically in code, but here is SQL just in case
UPDATE public.businesses 
SET opening_tasks_start_time = '07:30', closing_tasks_start_time = '15:00'
WHERE id IN (SELECT business_id FROM public.employees LIMIT 1); -- Safe fallback logic
