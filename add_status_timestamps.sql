-- Add timestamp columns to track order status changes
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN orders.ready_at IS 'Timestamp when order status changed to ready';
COMMENT ON COLUMN orders.completed_at IS 'Timestamp when order status changed to completed';
