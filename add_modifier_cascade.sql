-- Add menu_item_id to optiongroups to enable Private Groups logic
-- Using INTEGER as menu_items.id is likely an integer (based on previous errors)
ALTER TABLE optiongroups ADD COLUMN IF NOT EXISTS menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE;

-- Note: We are keeping the many-to-many table (menuitemoptions) for now to avoid breaking existing logic completely,
-- but the User Intent is to move towards strict ownership.
-- However, for the 'Private Group' logic to work, we filter by menu_item_id.

-- If we want to strictly enforce that deleting a dish deletes its PRIVATE groups, this FK handles it.
-- Existing shared groups (where menu_item_id is NULL) will remain unaffected by dish deletion.
