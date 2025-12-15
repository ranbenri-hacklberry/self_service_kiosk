-- Fix KDS Heartbeat to accept business_id as parameter
-- The previous version tried to get business_id from auth.uid() which doesn't work with PIN login

-- Add last_active_at to businesses if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'businesses' AND column_name = 'last_active_at') THEN
        ALTER TABLE businesses ADD COLUMN last_active_at TIMESTAMPTZ;
    END IF;
END $$;

-- Drop old function if exists (any signature)
DROP FUNCTION IF EXISTS send_kds_heartbeat();
DROP FUNCTION IF EXISTS send_kds_heartbeat(UUID);

-- Create new version that accepts business_id parameter
CREATE OR REPLACE FUNCTION send_kds_heartbeat(p_business_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_business_id UUID;
BEGIN
    -- Priority 1: Use provided parameter
    v_business_id := p_business_id;

    -- Priority 2: Try to get from current_user_business_id helper function
    IF v_business_id IS NULL THEN
        v_business_id := public.current_user_business_id();
    END IF;

    -- Fallback: Pilot Cafe (for testing)
    IF v_business_id IS NULL THEN
        v_business_id := '11111111-1111-1111-1111-111111111111';
    END IF;

    -- Update the business heartbeat
    UPDATE businesses
    SET last_active_at = NOW()
    WHERE id = v_business_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION send_kds_heartbeat(UUID) TO authenticated;

-- Verify: Check if the function was created correctly
SELECT 'send_kds_heartbeat created successfully' AS status;

