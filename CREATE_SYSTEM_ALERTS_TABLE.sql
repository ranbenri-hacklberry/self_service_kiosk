-- ========================================
-- KDS OBSERVABILITY: System Alerts Table
-- ========================================
-- This table stores alerts from the screenshot.sh fail-safe mechanism
-- When scrot fails, an alert is logged here for monitoring

-- Create system_alerts table
CREATE TABLE IF NOT EXISTS public.system_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('UI_HALT', 'SCREENSHOT_FAILURE', 'SYSTEM_ERROR', 'WARNING')),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id)
);

-- Add helpful comment
COMMENT ON TABLE public.system_alerts IS 'System-level alerts from automated monitoring scripts (e.g., screenshot.sh fail-safe)';

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_system_alerts_created_at 
ON public.system_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved 
ON public.system_alerts(resolved) 
WHERE NOT resolved;

CREATE INDEX IF NOT EXISTS idx_system_alerts_type 
ON public.system_alerts(alert_type);

CREATE INDEX IF NOT EXISTS idx_system_alerts_severity 
ON public.system_alerts(severity) 
WHERE severity = 'critical';

-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================

-- Enable RLS
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert alerts (for screenshot.sh)
CREATE POLICY "Service role can insert alerts"
ON public.system_alerts
FOR INSERT
TO service_role
WITH CHECK (true);

-- Policy: Authenticated users can view all alerts
CREATE POLICY "Authenticated users can view alerts"
ON public.system_alerts
FOR SELECT
TO authenticated
USING (true);

-- Policy: Authenticated users can mark alerts as resolved
CREATE POLICY "Authenticated users can resolve alerts"
ON public.system_alerts
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (
    -- Can only update 'resolved' and 'resolved_at' and 'resolved_by'
    (resolved IS NOT DISTINCT FROM resolved) OR 
    (resolved_at IS NOT DISTINCT FROM resolved_at) OR
    (resolved_by IS NOT DISTINCT FROM resolved_by)
);

-- ========================================
-- Grant Permissions
-- ========================================

-- Service role: can insert (for screenshot.sh via curl)
GRANT INSERT ON public.system_alerts TO service_role;

-- Authenticated users: can view and update
GRANT SELECT, UPDATE ON public.system_alerts TO authenticated;

-- Anon role: no access (extra security)
REVOKE ALL ON public.system_alerts FROM anon;

-- ========================================
-- Helper Function: Get Recent Critical Alerts
-- ========================================

CREATE OR REPLACE FUNCTION get_recent_critical_alerts(hours_ago INTEGER DEFAULT 24)
RETURNS TABLE (
    id UUID,
    alert_type TEXT,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        id, 
        alert_type, 
        message, 
        metadata, 
        created_at
    FROM public.system_alerts
    WHERE 
        severity = 'critical'
        AND NOT resolved
        AND created_at > NOW() - (hours_ago || ' hours')::INTERVAL
    ORDER BY created_at DESC;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_recent_critical_alerts TO authenticated;

-- ========================================
-- Test Data (Optional - for development)
-- ========================================

-- Uncomment to insert test alert:
/*
INSERT INTO public.system_alerts (alert_type, severity, message, metadata)
VALUES (
    'UI_HALT',
    'critical',
    'Test: Screenshot capture failed',
    '{"display": ":0", "timestamp": "2026-02-15T14:30:00Z", "screenshot_dir": "/home/icaffe/icaffe_logs/screenshots"}'::jsonb
);
*/

-- ========================================
-- Verification Queries
-- ========================================

-- Check table exists:
-- SELECT * FROM information_schema.tables WHERE table_name = 'system_alerts';

-- Check recent alerts:
-- SELECT * FROM system_alerts ORDER BY created_at DESC LIMIT 10;

-- Check RLS policies:
-- SELECT * FROM pg_policies WHERE tablename = 'system_alerts';

-- ========================================
-- END OF SCHEMA
-- ========================================
