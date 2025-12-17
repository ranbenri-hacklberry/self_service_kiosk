-- ==========================================
-- Toggle Early Delivered RPC Function
-- ==========================================
-- Creates the missing RPC function used by OrderEditModal

CREATE OR REPLACE FUNCTION toggle_early_delivered(
    p_item_id UUID,
    p_value BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the is_early_delivered flag for the specific order item
    UPDATE order_items
    SET
        is_early_delivered = p_value,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Log the change (optional)
    RAISE NOTICE 'Toggled early delivery for item % to %', p_item_id, p_value;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION toggle_early_delivered(UUID, BOOLEAN) TO authenticated;

-- Add comment
COMMENT ON FUNCTION toggle_early_delivered(UUID, BOOLEAN) IS 'Toggles the early delivery flag for order items in KDS edit mode';

SELECT 'toggle_early_delivered RPC function created successfully!' as status;
