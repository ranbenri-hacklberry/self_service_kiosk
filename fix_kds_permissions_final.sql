-- Fix KDS Permissions (OptionValues & Heartbeat) for Menu/System Connectivity

-- 1. Unblock Menu Lookups (Modifiers)
-- Without this, KDS/Manager cannot load menu modifiers properly
ALTER TABLE optionvalues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read OptionValues" ON optionvalues;
CREATE POLICY "Read OptionValues" ON optionvalues FOR SELECT TO authenticated USING (true);
GRANT SELECT ON optionvalues TO authenticated;

-- 2. Unblock KDS Heartbeat
-- If send_kds_heartbeat exists, we must allow KDS to call it to report status
DO $$
BEGIN
  GRANT EXECUTE ON FUNCTION send_kds_heartbeat TO authenticated;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if function missing (not critical for Inventory)
END $$;
