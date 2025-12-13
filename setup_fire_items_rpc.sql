CREATE OR REPLACE FUNCTION fire_items_v2(
    p_order_id uuid,
    p_item_ids uuid[]
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
    -- Update items
    UPDATE order_items
    SET 
        item_status = 'in_progress',
        item_fired_at = NOW()
    WHERE id = ANY(p_item_ids)
      AND order_id = p_order_id;

    -- Update order status if it was pending
    -- Only update if there are no more pending items? 
    -- Or just set to in_progress if we fire anything?
    -- Requirement: "Update item_status to 'FIRED' (or active status)."
    -- The order status logic is secondary but good to keep in sync.
    UPDATE orders
    SET order_status = 'in_progress'
    WHERE id = p_order_id
      AND order_status = 'pending';
END;
$function$;
