-- Update milk option prices to 2 NIS (instead of 3)
UPDATE optionvalues
SET price_adjustment = 2
WHERE value_name IN ('סויה', 'שיבולת שועל')
AND price_adjustment = 3;

-- Verify the update
SELECT 
    og.name as group_name,
    ov.value_name,
    ov.price_adjustment,
    ov.is_default
FROM optiongroups og
JOIN optionvalues ov ON og.id = ov.group_id
WHERE og.name ILIKE '%חלב%' OR ov.value_name ILIKE '%שיבולת%'
ORDER BY og.name, ov.value_name;
