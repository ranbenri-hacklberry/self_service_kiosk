
-- 1. Rename "Sausage" group to "Pesto"
UPDATE optiongroups
SET name = 'תוספות טוסט פסטו'
WHERE name LIKE '%נקניק%';

-- 2. Identify the groups linked to Item 8 (Pesto Toast)
-- We know from inspection that Item 8 has two groups: 
-- A. "תוספות טוסט" (ID: e2b43360-5831-4402-b96d-c08d5d0cbd59) -> The generic/old one
-- B. "תוספות טוסט פסטו" (Renamed from Sausage) (ID: 6fb8763d-8f80-4f22-b01e-48999968891d) -> The new specific one we want

-- 3. Remove the link to the generic group (A) from Item 8
DELETE FROM menuitemoptions 
WHERE item_id = 8 
  AND group_id IN (
      SELECT id FROM optiongroups WHERE name = 'תוספות טוסט'
  );

-- 4. Verify what's left for Item 8
SELECT * FROM optiongroups WHERE id IN (SELECT group_id FROM menuitemoptions WHERE item_id = 8);
