
-- 1. Link items 8 and 9 to group a7c44cf5-dc60-4944-abfa-d3d3f307e146
INSERT INTO menuitemoptions (item_id, group_id)
VALUES 
  (8, 'a7c44cf5-dc60-4944-abfa-d3d3f307e146'),
  (9, 'a7c44cf5-dc60-4944-abfa-d3d3f307e146')
ON CONFLICT (item_id, group_id) DO NOTHING;
