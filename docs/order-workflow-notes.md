# Order Workflow Notes

## Database Overview
- `public.orders`
  - `id` (uuid, pk)
  - `order_number` (bigint, required)
  - `customer_name` (text, nullable)
  - `order_status` (text, default `new`)
  - `is_paid` (boolean, default `false`)
  - `created_at` (timestamp, default now)
  - `customer_phone` (text, nullable)
  - `customer_id` (uuid, nullable)
- `public.order_items`
  - `id` (uuid, pk)
  - `order_id` (uuid)
  - `menu_item_id` (integer)
  - `quantity` (integer, default 1)
  - `mods` (text, nullable)
  - `item_status` (text, default `new`)
  - `created_at` (timestamp, default now)

## Supabase RPC Functions
- `finalize_order_with_customer(p_customer_phone text, p_customer_name text, p_items jsonb, p_is_paid boolean, p_customer_id uuid)`
- `advance_order_status(order_id uuid, new_status text)`
- Trigger: `order_notification_trigger` → `notify_order_change`

## Frontend Flow Highlights
- `customer-phone-input-screen` → identifies customer and stores `{ id, phone, name }` in `localStorage.currentCustomer`.
- `new-customer-name-collection-screen` → sends name to API which upserts the customer record.
- `menu-ordering-interface` → builds the order payload and calls `finalize_order_with_customer`.
- `KitchenDisplaySystemInterface` → loads orders and updates status.

## Outstanding Considerations
- Ensure `localStorage.currentCustomer.name` is populated when name entry succeeds.
- Confirm `finalize_order_with_customer` uses `COALESCE` for guest orders.
- Monitor Supabase logs for `orders` updates that fail due to RLS.
- When editing `upsert_customer`, alias the returned coffee count exactly as `loyalty_coffee_count` (e.g., `... AS loyalty_coffee_count`).
