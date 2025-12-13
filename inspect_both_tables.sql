
SELECT 
    t.table_name,
    c.column_name, 
    c.data_type 
FROM 
    information_schema.columns c
JOIN 
    information_schema.tables t ON c.table_name = t.table_name
WHERE 
    t.table_name IN ('supplier_orders', 'supplier_order_items')
ORDER BY 
    t.table_name, c.ordinal_position;
