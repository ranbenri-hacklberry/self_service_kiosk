-- RPC Function to get sales data (bypasses RLS)
DROP FUNCTION IF EXISTS get_sales_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_sales_data(
    p_business_id UUID,
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT COALESCE(json_agg(order_data ORDER BY order_data->>'created_at' DESC), '[]'::json)
        FROM (
            SELECT json_build_object(
                'id', o.id,
                'order_number', o.order_number,
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'total_amount', o.total_amount,
                'created_at', o.created_at,
                'order_items', (
                    SELECT COALESCE(json_agg(
                        json_build_object(
                            'quantity', oi.quantity,
                            'price', oi.price,
                            'menu_items', json_build_object(
                                'name', mi.name,
                                'category', mi.category,
                                'price', mi.price
                            )
                        )
                    ), '[]'::json)
                    FROM order_items oi
                    LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                    WHERE oi.order_id = o.id
                )
            ) as order_data
            FROM orders o
            WHERE o.business_id = p_business_id
            AND o.created_at >= p_start_date
            AND o.created_at <= p_end_date
            AND o.order_status != 'cancelled'
        ) subquery
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_sales_data(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

