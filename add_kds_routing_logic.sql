-- Add kds_routing_logic column to menu_items table
-- This column determines how items are routed to KDS and what modals to show

ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS kds_routing_logic VARCHAR(50);

-- Update salads to use CONDITIONAL logic (prep decision modal)
UPDATE menu_items 
SET kds_routing_logic = 'CONDITIONAL' 
WHERE category = 'סלטים' OR name LIKE '%סלט%';

-- Verify the update
SELECT id, name, category, kds_routing_logic 
FROM menu_items 
WHERE kds_routing_logic IS NOT NULL
ORDER BY category, name;
