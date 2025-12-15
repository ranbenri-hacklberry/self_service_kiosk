-- Check table names related to options/modifiers
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%option%' OR table_name LIKE '%modifier%')
ORDER BY table_name;
