-- Create order_transactions table
CREATE TABLE IF NOT EXISTS order_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('charge', 'refund')),
    payment_method TEXT,
    external_reference TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_order_transactions_order_id ON order_transactions(order_id);

-- Comment on table
COMMENT ON TABLE order_transactions IS 'Tracks individual payments and refunds for orders';
