SELECT 
    table_schema, 
    table_name, 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_name = 'loyalty_cards' 
    AND table_schema IN ('public', 'demo')
ORDER BY 
    table_schema, column_name;
