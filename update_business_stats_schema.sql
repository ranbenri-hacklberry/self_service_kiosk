-- Add last_active_at to businesses if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'last_active_at') THEN
        ALTER TABLE businesses ADD COLUMN last_active_at TIMESTAMPTZ;
    END IF;
END $$;

-- RPC to update heartbeat (called by KDS)
CREATE OR REPLACE FUNCTION send_kds_heartbeat()
RETURNS BOOLEAN AS $$
DECLARE
    v_business_id UUID;
BEGIN
    -- Get business_id from current session (RLS) or direct param if we were passing it, 
    -- but usually we rely on auth.uid() -> mapping to employee -> business_id.
    -- Assuming the standard RLS setup where we can get the business_id from the user's claims or table.
    -- However, for simplicity and robustness with the current auth context in `useAuth`:
    -- We'll try to get it from the `employees` table for the current user.
    
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE id = auth.uid()::uuid;

    IF v_business_id IS NULL THEN
        -- Fallback: try to see if the user IS the business (unlikely in this app structure but good for safety)
        -- Or just return false.
        RETURN FALSE;
    END IF;

    UPDATE businesses
    SET last_active_at = NOW()
    WHERE id = v_business_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to get all stats for Super Admin
-- Returns business basic info + calculated stats
CREATE OR REPLACE FUNCTION get_all_business_stats()
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    is_online BOOLEAN,
    active_orders_count BIGINT,
    orders_last_hour_count BIGINT,
    employee_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.created_at,
        b.last_active_at,
        (b.last_active_at > (NOW() - INTERVAL '2 minutes')) AS is_online,
        
        -- Active orders (not completed, not cancelled)
        (SELECT COUNT(*) FROM orders o 
         WHERE o.business_id = b.id 
         AND o.order_status NOT IN ('completed', 'cancelled')
        ) AS active_orders_count,

        -- Orders last hour
        (SELECT COUNT(*) FROM orders o 
         WHERE o.business_id = b.id 
         AND o.created_at > (NOW() - INTERVAL '1 hour')
        ) AS orders_last_hour_count,

        -- Employee count
        (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id) AS employee_count

    FROM businesses b
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
