
-- Remove the link properly
DELETE FROM menuitemoptions 
WHERE item_id = 8 and group_id = 'e2b43360-5831-4402-b96d-c08d5d0cbd59';

-- Verify
SELECT * FROM optiongroups 
WHERE id IN (SELECT group_id FROM menuitemoptions WHERE item_id = 8);
