-- Check structure of supplier_delivery_schedule
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'supplier_delivery_schedule'
ORDER BY ordinal_position;

-- Check structure of kitchentasks
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'kitchentasks'
ORDER BY ordinal_position;

-- Check structure of existing tasks table for comparison
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

-- Check structure of existing suppliers table
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'suppliers'
ORDER BY ordinal_position;
