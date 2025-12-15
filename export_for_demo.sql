-- ============================================
-- EXPORT SCHEMA FOR DEMO (Fixed for PostgreSQL 15+)
-- Run in Production (gxzsxvbercpkgxraiaex)
-- ============================================

SELECT 
  'CREATE TABLE IF NOT EXISTS public.' || c.relname || ' (' ||
  string_agg(
    a.attname || ' ' || 
    pg_catalog.format_type(a.atttypid, a.atttypmod) ||
    CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
    CASE 
      WHEN d.adrelid IS NOT NULL THEN ' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid)
      ELSE '' 
    END,
    ', ' ORDER BY a.attnum
  ) ||
  ');' as ddl
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND a.attnum > 0
  AND NOT a.attisdropped
GROUP BY c.relname
ORDER BY c.relname;
