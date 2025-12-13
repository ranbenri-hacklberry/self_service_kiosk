-- Add missing columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT,
ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2);

-- Update existing rows if needed (optional)
-- UPDATE orders SET payment_method = 'cash' WHERE payment_method IS NULL;
