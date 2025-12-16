-- RPC Function to update a menu item (bypasses RLS)
-- This ensures managers can always update menu items regardless of RLS policies

CREATE OR REPLACE FUNCTION update_menu_item(
    p_item_id UUID,
    p_name TEXT DEFAULT NULL,
    p_price NUMERIC DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_image_url TEXT DEFAULT NULL,
    p_is_in_stock BOOLEAN DEFAULT NULL,
    p_allow_notes BOOLEAN DEFAULT NULL,
    p_sale_price NUMERIC DEFAULT NULL,
    p_sale_start_date DATE DEFAULT NULL,
    p_sale_end_date DATE DEFAULT NULL,
    p_sale_start_time TIME DEFAULT NULL,
    p_sale_end_time TIME DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    UPDATE menu_items SET
        name = COALESCE(p_name, name),
        price = COALESCE(p_price, price),
        description = COALESCE(p_description, description),
        category = COALESCE(p_category, category),
        image_url = COALESCE(p_image_url, image_url),
        is_in_stock = COALESCE(p_is_in_stock, is_in_stock),
        allow_notes = COALESCE(p_allow_notes, allow_notes),
        sale_price = p_sale_price, -- Allow null to clear
        sale_start_date = p_sale_start_date,
        sale_end_date = p_sale_end_date,
        sale_start_time = p_sale_start_time,
        sale_end_time = p_sale_end_time,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Return the updated item
    SELECT json_build_object(
        'id', id,
        'name', name,
        'price', price,
        'description', description,
        'category', category,
        'image_url', image_url,
        'is_in_stock', is_in_stock,
        'allow_notes', allow_notes,
        'sale_price', sale_price,
        'sale_start_date', sale_start_date,
        'sale_end_date', sale_end_date
    ) INTO result
    FROM menu_items
    WHERE id = p_item_id;

    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION update_menu_item(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, NUMERIC, DATE, DATE, TIME, TIME) TO authenticated;

-- Also ensure basic RLS policy exists for menu_items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Menu items read access" ON menu_items;
CREATE POLICY "Menu items read access" ON menu_items
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Menu items write access" ON menu_items;
CREATE POLICY "Menu items write access" ON menu_items
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'update_menu_item RPC and policies created!' as status;

