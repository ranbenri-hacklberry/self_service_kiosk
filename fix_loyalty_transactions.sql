-- Add missing columns to public.loyalty_transactions
ALTER TABLE public.loyalty_transactions 
ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0;

ALTER TABLE public.loyalty_transactions 
ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0;

ALTER TABLE public.loyalty_transactions 
ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL;

-- Add missing columns to demo.loyalty_transactions
ALTER TABLE demo.loyalty_transactions 
ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0;

ALTER TABLE demo.loyalty_transactions 
ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0;

ALTER TABLE demo.loyalty_transactions 
ADD COLUMN IF NOT EXISTS created_by UUID DEFAULT NULL;
