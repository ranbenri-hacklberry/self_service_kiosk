-- Check columns in menuitemoptions table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menuitemoptions'
ORDER BY ordinal_position;

-- Check columns in optiongroups table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'optiongroups'
ORDER BY ordinal_position;

-- Check columns in optionvalues table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'optionvalues'
ORDER BY ordinal_position;
