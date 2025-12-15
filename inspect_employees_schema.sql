-- INSPECT EMPLOYEES TABLE
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'employees';

-- Also sample data to be sure
SELECT * FROM employees LIMIT 1;
