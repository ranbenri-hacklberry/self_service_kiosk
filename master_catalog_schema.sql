-- MASTER CATALOG SCHEMA
-- This schema establishes the "Master" read-only data for all businesses.

-- 1. Master Categories
-- Standard menu categories (Starters, Mains, Drinks)
CREATE TABLE IF NOT EXISTS public.master_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    type TEXT CHECK (type IN ('food', 'drink', 'other')),
    course_type TEXT, -- 'starter', 'main', 'dessert', 'beverage'
    display_order SERIAL
);

-- 2. Master Ingredients
-- The fundamental list of all known ingredients/products
CREATE TABLE IF NOT EXISTS public.master_ingredients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    default_unit TEXT DEFAULT 'Kg',
    department TEXT, -- 'Produce', 'Meat', 'Dairy', 'Dry Goods', 'Alcohol'
    is_allergen BOOLEAN DEFAULT false,
    image_url TEXT
);

-- 3. Master Suppliers
-- Known suppliers
CREATE TABLE IF NOT EXISTS public.master_suppliers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    contact_phone TEXT,
    departments TEXT[] -- Array of departments they specialize in
);

-- 4. Master Supplier Catalog (Junction)
-- Links ingredients to suppliers to enable "Order from Supplier" logic
CREATE TABLE IF NOT EXISTS public.master_supplier_catalog (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supplier_id UUID REFERENCES public.master_suppliers(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES public.master_ingredients(id) ON DELETE CASCADE,
    catalog_sku TEXT,
    UNIQUE(supplier_id, ingredient_id)
);

-- 5. Master Option Groups (Modifiers)
-- Standard modifier sets like "Steak Doneness", "Salad Dressing"
CREATE TABLE IF NOT EXISTS public.master_option_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_food BOOLEAN DEFAULT true,
    is_drink BOOLEAN DEFAULT false,
    min_select INT DEFAULT 0,
    max_select INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS public.master_option_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.master_option_groups(id) ON DELETE CASCADE,
    value_name TEXT NOT NULL,
    default_price_adjustment NUMERIC DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    UNIQUE(group_id, value_name)
);

-- ENABLE RLS on Master Tables
-- Everyone (Authenticated) can READ. Only Super Admin (or no one) can WRITE.

ALTER TABLE public.master_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_supplier_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_option_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_option_values ENABLE ROW LEVEL SECURITY;

-- Read Policy: All authenticated users can read
CREATE POLICY "Allow Read All" ON public.master_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow Read All" ON public.master_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow Read All" ON public.master_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow Read All" ON public.master_supplier_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow Read All" ON public.master_option_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow Read All" ON public.master_option_values FOR SELECT TO authenticated USING (true);

-- Write Policy: Deny all (for now, seeding done via Service Role or direct SQL)
-- In future, Super Admin would have write access.
