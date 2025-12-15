-- ============================================
-- EXPORT FULL SCHEMA
-- Run in Supabase SQL Editor and save result
-- ============================================

-- Get all table definitions with columns
SELECT 
  'CREATE TABLE IF NOT EXISTS ' || tablename || ' (' ||
  string_agg(
    column_name || ' ' || 
    data_type || 
    CASE WHEN character_maximum_length IS NOT NULL 
         THEN '(' || character_maximum_length || ')' 
         ELSE '' END ||
    CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
    CASE WHEN column_default IS NOT NULL 
         THEN ' DEFAULT ' || column_default 
         ELSE '' END,
    ', '
  ) || ');' as create_statement
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY tablename
ORDER BY tablename;
