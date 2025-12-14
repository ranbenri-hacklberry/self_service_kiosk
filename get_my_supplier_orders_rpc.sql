-- RPC to fetch supplier orders (Bypassing RLS for reliability)

CREATE OR REPLACE FUNCTION get_my_supplier_orders(p_business_id UUID)
RETURNS TABLE (
    id BIGINT,
    created_at TIMESTAMPTZ,
    supplier_name TEXT,
    status TEXT,
    items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        so.id,
        so.created_at,
        s.name as supplier_name,
        so.status,
        (
            SELECT jsonb_agg(jsonb_build_object(
                'name', ii.name,
                'qty', soi.quantity,
                'unit', ii.unit,
                'inventory_item_id', soi.inventory_item_id
            ))
            FROM supplier_order_items soi
            JOIN inventory_items ii ON ii.id = soi.inventory_item_id
            WHERE soi.supplier_order_id = so.id
        ) as items
    FROM supplier_orders so
    LEFT JOIN suppliers s ON s.id = so.supplier_id
    WHERE so.business_id = p_business_id
    AND so.status = 'sent'
    ORDER BY so.created_at DESC;
END;
$$;
