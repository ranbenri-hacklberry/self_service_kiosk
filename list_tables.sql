-- Run this in Supabase SQL Editor to list all tables
SELECT 
  schemaname,
  tablename,
  (SELECT count(*) FROM information_schema.columns WHERE table_name = t.tablename) as column_count
FROM pg_tables t
WHERE schemaname IN ('public', 'demo')
ORDER BY schemaname, tablename;

-- Also get row counts
SELECT 
  schemaname,
  relname as tablename,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname IN ('public', 'demo')
ORDER BY schemaname, relname;
