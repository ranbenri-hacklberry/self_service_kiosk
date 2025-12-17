-- ==========================================
-- KDS Fixes & Enhancements Setup Script
-- ==========================================
-- This script sequentially:
-- 1. Updates Schema (Adds missing columns)
-- 2. Sets up Auto-Update Triggers
-- 3. Creates/Replaces Helper Functions (History, Delete)
-- 4. Grants Permissions
-- 5. Backfills missing data

-- 1. SCHMEA FIX: Add 'updated_at' column if missing
-- This must run FIRST so the functions below don't fail properly
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updated_at') THEN
        ALTER TABLE orders ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. TRIGGER SETUP: Auto-Update 'updated_at'
-- Ensures every change to an order updates this timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 3. FUNCTION CLEANUP
DROP FUNCTION IF EXISTS get_kds_history_orders_v2;
DROP FUNCTION IF EXISTS delete_order_secure;

-- 4. HISTORY FETCH FUNCTION (V2)
-- Now safe to create because updated_at exists
CREATE OR REPLACE FUNCTION public.get_kds_history_orders_v2(
  p_start_date TEXT,
  p_end_date TEXT,
  p_business_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  order_status TEXT,
  is_paid BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  fired_at TIMESTAMP WITH TIME ZONE,
  ready_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_refund BOOLEAN,
  refund_amount NUMERIC,
  customer_name TEXT,
  customer_phone TEXT,
  total_amount NUMERIC,
  paid_amount NUMERIC,
  order_items JSON
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.order_status,
    o.is_paid,
    o.created_at,
    o.fired_at,
    o.ready_at,
    o.updated_at,
    o.is_refund,
    o.refund_amount,
    o.customer_name,
    o.customer_phone,
    o.total AS total_amount,
    o.total AS paid_amount,
    COALESCE(
      json_agg(
        json_build_object(
          'id', oi.id,
          'quantity', oi.quantity,
          'item_status', oi.item_status,
          'price', oi.price,
          'mods', oi.mods,
          'notes', oi.notes,
          'menu_item_id', m.id,
          'name', m.name
        ) ORDER BY oi.id
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'
    ) AS order_items
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  LEFT JOIN menu_items m ON oi.menu_item_id = m.id
  WHERE o.created_at >= p_start_date::timestamptz
    AND o.created_at <= p_end_date::timestamptz
    AND (
      p_business_id IS NULL OR o.business_id = p_business_id
    )
  GROUP BY o.id
  ORDER BY o.created_at DESC;
END;
$$;

-- 5. SECURE DELETE FUNCTION
CREATE OR REPLACE FUNCTION public.delete_order_secure(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM order_items WHERE order_id = p_order_id;
  DELETE FROM orders WHERE id = p_order_id;
END;
$$;

-- 6. PERMISSIONS & RELOAD
GRANT EXECUTE ON FUNCTION get_kds_history_orders_v2 TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_order_secure TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- 7. BACKFILL (One-time fix for existing records)
UPDATE orders SET updated_at = created_at WHERE updated_at IS NULL;
