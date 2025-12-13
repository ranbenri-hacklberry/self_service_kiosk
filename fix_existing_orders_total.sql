-- Fix all orders with total_amount = 0 by recalculating from order_items
UPDATE orders o
SET total_amount = (
    SELECT COALESCE(SUM(oi.price * oi.quantity), 0)
    FROM order_items oi
    WHERE oi.order_id = o.id
      AND oi.item_status != 'cancelled'
)
WHERE o.total_amount = 0 OR o.total_amount IS NULL;
