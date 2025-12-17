
-- Enable RLS on optiongroups if not enabled
ALTER TABLE optiongroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE optionvalues ENABLE ROW LEVEL SECURITY;

-- Allow anonymous read access to optiongroups
CREATE POLICY "Allow anonymous read access to optiongroups"
ON optiongroups FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anonymous read access to optionvalues
CREATE POLICY "Allow anonymous read access to optionvalues"
ON optionvalues FOR SELECT
TO anon, authenticated
USING (true);

-- Allow authenticated Insert/Update/Delete (Manager)
CREATE POLICY "Allow authenticated full access to optiongroups"
ON optiongroups FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to optionvalues"
ON optionvalues FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
