-- Create table for tracking active device sessions
CREATE TABLE IF NOT EXISTS device_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL, -- Unique ID generated per browser/device
    device_type TEXT NOT NULL, -- 'kds', 'kiosk', 'manager'
    device_name TEXT, -- Optional friendly name
    user_name TEXT, -- Connected user's name
    employee_id UUID, -- Reference to employee if applicable
    ip_address TEXT,
    user_agent TEXT,
    screen_resolution TEXT,
    session_started_at TIMESTAMPTZ DEFAULT NOW(), -- When user first connected
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(device_id)
);

-- Enable RLS
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to manage their business sessions
CREATE POLICY "Sessions access" ON device_sessions
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant access
GRANT ALL ON device_sessions TO authenticated;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_device_sessions_business ON device_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_device_sessions_last_seen ON device_sessions(last_seen_at);

-- Updated heartbeat function that accepts device info including user name
DROP FUNCTION IF EXISTS send_device_heartbeat(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS send_device_heartbeat(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION send_device_heartbeat(
    p_business_id UUID,
    p_device_id TEXT,
    p_device_type TEXT DEFAULT 'kds',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_screen_resolution TEXT DEFAULT NULL,
    p_user_name TEXT DEFAULT NULL,
    p_employee_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Upsert device session
    INSERT INTO device_sessions (
        business_id, device_id, device_type, ip_address, user_agent, screen_resolution, 
        user_name, employee_id, session_started_at, last_seen_at
    ) VALUES (
        p_business_id, p_device_id, p_device_type, p_ip_address, p_user_agent, p_screen_resolution,
        p_user_name, p_employee_id, NOW(), NOW()
    )
    ON CONFLICT (device_id) 
    DO UPDATE SET 
        ip_address = COALESCE(EXCLUDED.ip_address, device_sessions.ip_address),
        user_agent = COALESCE(EXCLUDED.user_agent, device_sessions.user_agent),
        screen_resolution = COALESCE(EXCLUDED.screen_resolution, device_sessions.screen_resolution),
        user_name = COALESCE(EXCLUDED.user_name, device_sessions.user_name),
        employee_id = COALESCE(EXCLUDED.employee_id, device_sessions.employee_id),
        -- Keep original session_started_at, don't overwrite
        last_seen_at = NOW();

    -- Also update business last_active_at for backward compatibility
    UPDATE businesses SET last_active_at = NOW() WHERE id = p_business_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_device_heartbeat(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) TO authenticated;

-- Clean up old sessions (older than 10 minutes = offline)
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM device_sessions WHERE last_seen_at < (NOW() - INTERVAL '10 minutes');
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated get_all_business_stats to include active devices with user info
DROP FUNCTION IF EXISTS get_all_business_stats();

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
    settings JSONB,
    active_devices JSON
) AS $$
BEGIN
    -- First clean up stale sessions
    PERFORM cleanup_stale_sessions();
    
    RETURN QUERY
    SELECT 
        b.id,
        b.name,
        b.created_at,
        b.last_active_at,
        (b.last_active_at > (NOW() - INTERVAL '2 minutes')) AS is_online,
        (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id AND o.order_status NOT IN ('completed', 'cancelled')) AS active_orders_count,
        (SELECT COUNT(*) FROM orders o WHERE o.business_id = b.id AND o.created_at > (NOW() - INTERVAL '1 hour')) AS orders_last_hour_count,
        (SELECT COUNT(*) FROM employees e WHERE e.business_id = b.id) AS employee_count,
        b.settings,
        (
            SELECT COALESCE(json_agg(json_build_object(
                'device_id', ds.device_id,
                'device_type', ds.device_type,
                'user_name', ds.user_name,
                'ip_address', ds.ip_address,
                'screen_resolution', ds.screen_resolution,
                'session_started_at', ds.session_started_at,
                'last_seen_at', ds.last_seen_at
            )), '[]'::json)
            FROM device_sessions ds 
            WHERE ds.business_id = b.id 
            AND ds.last_seen_at > (NOW() - INTERVAL '2 minutes')
        ) AS active_devices
    FROM businesses b
    ORDER BY b.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_all_business_stats() TO authenticated;

