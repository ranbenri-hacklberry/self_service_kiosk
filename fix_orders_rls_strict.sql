-- FIX ORDERS RLS SECURITY (STRICT)

-- 1. Drop existing loose policies
DROP POLICY IF EXISTS "Allow anon delete orders" ON public.orders;
DROP POLICY IF EXISTS "Allow anon insert orders" ON public.orders;
DROP POLICY IF EXISTS "Allow anon read orders" ON public.orders;
DROP POLICY IF EXISTS "Allow anon update orders" ON public.orders;
DROP POLICY IF EXISTS "kds_realtime_orders" ON public.orders;
DROP POLICY IF EXISTS "Orders isolation" ON public.orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.orders;

-- 2. Authenticated Staff Access (Full Access to own business)
-- Uses the extensive check against employees table to ensure correct business isolation
CREATE POLICY "Staff Access Own Business" ON public.orders
FOR ALL
TO authenticated
USING (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    business_id IN (
        SELECT business_id FROM public.employees 
        WHERE auth_user_id = auth.uid()
    )
);

-- 3. Anon Insert (Kiosk / Customer Phone)
-- Allow inserting new orders freely (needed for public kiosks)
-- BUT NO SELECT/UPDATE/DELETE permissions for anon
CREATE POLICY "Anon Create Orders" ON public.orders
FOR INSERT
TO anon
WITH CHECK (true);

-- 4. Enable RLS (Ensure it is on)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- 5. Fix Realtime Broadcast (Supabase Realtime respects RLS)
-- By restricting SELECT to Staff only, Realtime will only broadcast to Staff users.
-- Anon users listening to 'orders' will receive nothing.

-- 6. Helper for "Track Order" or "Get Order Status" (if needed for anon)
-- Creating a secure function that bypasses RLS safely for specific lookups only
CREATE OR REPLACE FUNCTION public.get_order_status_anon(p_order_id UUID)
RETURNS TABLE (status text, order_number bigint, details jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.order_status, 
        o.order_number,
        jsonb_build_object('created_at', o.created_at)
    FROM public.orders o
    WHERE o.id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_status_anon(UUID) TO anon;
