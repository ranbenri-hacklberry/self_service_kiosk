
SELECT 
    pg_type.typname AS enum_type, 
    pg_enum.enumlabel AS enum_value
FROM 
    pg_type 
JOIN 
    pg_enum ON pg_type.oid = pg_enum.enumtypid 
WHERE 
    pg_type.typname = 'item_status_enum' -- Adjust if the enum name is different
    OR pg_type.typname = 'order_status_enum';

-- Also check check constraints if it's not an enum
SELECT 
    conname, 
    pg_get_constraintdef(oid) 
FROM 
    pg_constraint 
WHERE 
    conrelid = 'order_items'::regclass;
