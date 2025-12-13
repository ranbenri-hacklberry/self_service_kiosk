-- Update items to NOT require preparation (hide from KDS)

-- 1. Cold Drinks (Self service / Pre-packaged)
UPDATE menu_items
SET is_prep_required = false
WHERE id IN (25, 26, 27, 56); -- פחית, בקבוק, טרופית, אייסקפה

-- 2. Salads (Ready made)
UPDATE menu_items
SET is_prep_required = false
WHERE category = 'סלטים';

-- 3. Desserts (Ready made)
UPDATE menu_items
SET is_prep_required = false
WHERE category = 'קינוחים';

-- 4. Specific Sandwiches (Ready made)
UPDATE menu_items
SET is_prep_required = false
WHERE id IN (51, 52); -- קרואסלק, קרואסלמון

-- Verification Query
SELECT id, name, category, is_prep_required
FROM menu_items
WHERE is_prep_required = false
ORDER BY category, name;

