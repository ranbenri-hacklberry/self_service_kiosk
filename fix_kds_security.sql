-- Enhanced version of update_order_status that cascades changes to items
-- Removed explicit cast to item_status_enum as it was causing type errors
CREATE OR REPLACE FUNCTION update_order_status(p_order_id UUID, p_status TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Update the Order
    UPDATE orders
    SET order_status = p_status,
        ready_at = CASE 
            WHEN p_status = 'ready' AND ready_at IS NULL THEN NOW() 
            ELSE ready_at 
        END,
        completed_at = CASE 
            WHEN p_status = 'completed' AND completed_at IS NULL THEN NOW() 
            ELSE completed_at 
        END
    WHERE id = p_order_id;

    -- 2. Update the Items (Cascade the status)
    -- Postgres will automatically attempt to cast the text to the enum if the column is an enum
    UPDATE order_items
    SET item_status = p_status
    WHERE order_id = p_order_id
    AND item_status != 'cancelled' 
    AND item_status != 'completed'; 
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_status(UUID, TEXT) TO service_role;
