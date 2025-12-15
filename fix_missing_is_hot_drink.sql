
-- Fix missing is_hot_drink column in menu_items
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS is_hot_drink boolean DEFAULT false;

-- Update existing items based on category or name
UPDATE menu_items 
SET is_hot_drink = true 
WHERE category LIKE '%חמים%' 
   OR category LIKE '%Hot%' 
   OR name LIKE '%קפה%' 
   OR name LIKE '%Espresso%'
   OR name LIKE '%הפוך%'
   OR name LIKE '%אמריקנו%'
   OR name LIKE '%תה%'
   OR name LIKE '%שוקו%';

-- Verify
SELECT id, name, is_hot_drink FROM menu_items WHERE is_hot_drink = true LIMIT 5;
