-- Restore price for Soy and Oat milk to 3 NIS
UPDATE optionvalues
SET price_adjustment = 3
WHERE value_name LIKE '%סויה%' 
   OR value_name LIKE '%שיבולת%'
   OR value_name LIKE '%שקדים%';

-- Verify
SELECT 
    og.name as group_name,
    ov.value_name,
    ov.price_adjustment
FROM optionvalues ov
JOIN optiongroups og ON ov.group_id = og.id
WHERE ov.value_name LIKE '%סויה%' 
   OR ov.value_name LIKE '%שיבולת%'
   OR ov.value_name LIKE '%שקדים%';
