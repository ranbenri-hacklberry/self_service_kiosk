-- Check current prices for soy and oat milk
SELECT 
    og.name as group_name,
    ov.value_name,
    ov.price_adjustment,
    ov.is_default
FROM optiongroups og
JOIN optionvalues ov ON og.id = ov.group_id
WHERE ov.value_name ILIKE '%סויה%' 
   OR ov.value_name ILIKE '%שיבולת%'
   OR ov.value_name ILIKE '%שקדים%'
ORDER BY og.name, ov.value_name;
