
-- 1. Identify ALL links for item 8 and log them (by selecting)
SELECT item_id, group_id FROM menuitemoptions WHERE item_id = 8;

-- 2. Explicitly DELETE the link to the OLD group 'e2b43360-5831-4402-b96d-c08d5d0cbd59'
-- (This ID was found in the verification step earlier)
DELETE FROM menuitemoptions 
WHERE item_id = 8 
AND group_id = 'e2b43360-5831-4402-b96d-c08d5d0cbd59';

-- 3. Verify again
SELECT * FROM optiongroups 
WHERE id IN (
  SELECT group_id FROM menuitemoptions WHERE item_id = 8
);
