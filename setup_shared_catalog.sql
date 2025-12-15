-- ============================================================
-- 📦 SETUP SHARED CATALOG (PHASE 3)
-- ============================================================

-- 1. Create the Global Catalog Table
CREATE TABLE IF NOT EXISTS public.catalog_items (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    default_unit TEXT,
    category TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT catalog_items_pkey PRIMARY KEY (id),
    CONSTRAINT catalog_items_name_key UNIQUE (name) -- Ensure unique names in catalog
);

-- 2. Populate Catalog from Existing Inventory (Harvesting Distinct Items)
-- We take the "Pilot Cafe" inventory as the source of truth for the initial catalog
INSERT INTO catalog_items (name, default_unit, category)
SELECT 
    TRIM(name), 
    mode() WITHIN GROUP (ORDER BY unit), -- Pick most common unit
    mode() WITHIN GROUP (ORDER BY category) -- Pick most common category
FROM inventory_items
WHERE business_id = '11111111-1111-1111-1111-111111111111'
GROUP BY TRIM(name) -- Fixed: Added GROUP BY
ON CONFLICT (name) DO NOTHING;

-- 3. Add Linkage Column to Inventory Items
-- DO block to avoid errors if exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_items' AND column_name = 'catalog_item_id') THEN
        ALTER TABLE inventory_items ADD COLUMN catalog_item_id UUID REFERENCES catalog_items(id);
    END IF;
END $$;

-- 4. Link Existing Inventory to Catalog Items
UPDATE inventory_items ii
SET catalog_item_id = ci.id
FROM catalog_items ci
WHERE TRIM(ii.name) = ci.name
  AND ii.catalog_item_id IS NULL;

-- 5. Enable RLS for Catalog
ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies for Catalog
-- READ: All Authenticated Users can READ the catalog
DROP POLICY IF EXISTS "Catalog is readable by all" ON catalog_items;
CREATE POLICY "Catalog is readable by all" ON catalog_items
    FOR SELECT TO authenticated
    USING (true);

-- WRITE: Only Service Role / Admin can EDIT (For now)
-- Regular users cannot insert/update catalog directly unless we allow "Suggest Item"
DROP POLICY IF EXISTS "Catalog is editable by admins only" ON catalog_items;
CREATE POLICY "Catalog is editable by admins only" ON catalog_items
    FOR ALL TO authenticated
    USING (
         -- Allow only if user is admin (check employees table for admin flag)
         EXISTS (
             SELECT 1 FROM employees 
             WHERE auth_user_id = auth.uid() 
             AND is_admin = true
         )
    );

SELECT 'Shared Catalog Created, Populated, and Linked.' as status;
