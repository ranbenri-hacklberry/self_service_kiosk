-- Grant permissions to allow the API (anon/authenticated) to call these functions
GRANT EXECUTE ON FUNCTION get_all_business_stats() TO anon, authenticated, SERVICE_ROLE;
GRANT EXECUTE ON FUNCTION send_kds_heartbeat() TO anon, authenticated, SERVICE_ROLE;

-- Optional: Reset owner to postgres just in case (though usually it is the creator)
-- ALTER FUNCTION get_all_business_stats() OWNER TO postgres;

-- Ensure the function can see the tables by setting search_path (Good practice for Security Definer)
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
        (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id AND o.order_status NOT IN ('completed', 'cancelled')) AS active_orders_count,
        (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id AND o.created_at > (NOW() - INTERVAL '1 hour')) AS orders_last_hour_count,
        (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id) AS employee_count
    FROM businesses b
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-apply Heartbeat with search_path too
CREATE OR REPLACE FUNCTION send_kds_heartbeat()
RETURNS BOOLEAN AS $$
DECLARE
    v_business_id UUID;
BEGIN
    SELECT business_id INTO v_business_id
    FROM employees
    WHERE id = auth.uid()::uuid;

    IF v_business_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE businesses
    SET last_active_at = NOW()
    WHERE id = v_business_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
