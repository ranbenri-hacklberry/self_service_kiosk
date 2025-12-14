-- Create table for tracking recurring task completions daily
CREATE TABLE IF NOT EXISTS public.task_completions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recurring_task_id INTEGER REFERENCES public.recurring_tasks(id),
    business_id UUID,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    completed_by UUID,
    completion_date DATE DEFAULT CURRENT_DATE,
    quantity_produced NUMERIC,
    notes TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_completions_date ON public.task_completions(completion_date);
CREATE INDEX IF NOT EXISTS idx_task_completions_business ON public.task_completions(business_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_task_id ON public.task_completions(recurring_task_id);

-- Add description column if it doesn't exist (it should, but just in case)
ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE recurring_tasks ADD COLUMN IF NOT EXISTS image_url TEXT; -- Nice to have for visual
