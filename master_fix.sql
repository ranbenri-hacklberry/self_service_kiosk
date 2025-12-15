DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'last_active_at') THEN
        ALTER TABLE businesses ADD COLUMN last_active_at TIMESTAMPTZ;
    END IF;
END $$;

DROP FUNCTION IF EXISTS get_all_business_stats();
DROP FUNCTION IF EXISTS send_kds_heartbeat();

CREATE OR REPLACE FUNCTION send_kds_heartbeat()
RETURNS BOOLEAN AS $$
DECLARE
    v_business_id UUID;
BEGIN
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE id = auth.uid()::uuid;

    IF v_business_id IS NOT NULL THEN
        UPDATE businesses
        SET last_active_at = NOW()
        WHERE id = v_business_id;
        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_all_business_stats()
RETURNS TABLE (
    id UUID,
    name TEXT,
    created_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    is_online BOOLEAN,
    active_orders_count BIGINT,
    orders_last_hour_count BIGINT,
    employee_count BIGINT,
    settings JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.created_at,
        b.last_active_at,
        (COALESCE(b.last_active_at, '1970-01-01'::timestamptz) > (NOW() - INTERVAL '2 minutes')) AS is_online,
        (SELECT COUNT(*) FROM orders o 
         WHERE o.business_id = b.id 
         AND o.order_status NOT IN ('completed', 'cancelled')
        ) AS active_orders_count,
        (SELECT COUNT(*) FROM orders o 
         WHERE o.business_id = b.id 
         AND o.created_at > (NOW() - INTERVAL '1 hour')
        ) AS orders_last_hour_count,
        (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id) AS employee_count,
        b.settings
    FROM businesses b
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_all_business_stats() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION send_kds_heartbeat() TO anon, authenticated, service_role;
GRANT SELECT ON businesses TO anon, authenticated, service_role;
GRANT SELECT ON employees TO anon, authenticated, service_role;
GRANT SELECT ON orders TO anon, authenticated, service_role;
