-- 1. Ensure Table Permissions
GRANT SELECT ON public.discounts TO anon, authenticated, service_role;

-- 2. Setup RLS for Discounts
ALTER TABLE public.discounts ENABLE ROW LEVEL SECURITY;

-- Remove existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON public.discounts;

-- Create comprehensive read policy
CREATE POLICY "Public read access"
ON public.discounts
FOR SELECT
TO public
USING (true); -- Allow reading all discounts (client filters by business_id)

-- 3. Ensure RPC Permissions
GRANT EXECUTE ON FUNCTION public.submit_order_v2 TO anon, authenticated, service_role;

-- 4. Force Schema Cache Reload
NOTIFY pgrst, 'reload config';
