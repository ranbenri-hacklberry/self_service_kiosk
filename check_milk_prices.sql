-- Check price adjustments for milk options
SELECT 
    og.name as group_name,
    ov.value_name,
    ov.price_adjustment,
    ov.is_default
FROM optiongroups og
JOIN optionvalues ov ON og.id = ov.group_id
WHERE og.name ILIKE '%חלב%' OR ov.value_name ILIKE '%שיבולת%'
ORDER BY og.name, ov.value_name;
