# ⚡ iCaffeOS Supabase RPC Guide

This document lists the essential PostgreSQL functions (RPCs) used by the frontend to maintain transactional integrity, handle complex business logic, and bypass RLS where necessary (Security Definer).

---

## 🛒 Order Management

### `submit_order_v3`

The most critical function in the system. Handles the atomic creation of an order and its items.

- **Parameters:** `p_order_data` (JSONB)
- **Logic:**
  - Validates business ID.
  - Creates record in `orders`.
  - Creates records in `order_items`.
  - Deducts inventory if applicable.
  - Returns the created order object.

### `confirm_order_payment`

Updates an order status to paid and handles financial recording.

- **Parameters:** `p_order_id` (UUID), `p_payment_method` (TEXT), `p_amount` (NUMERIC)
- **Security:** Security Definer (bypasses RLS to ensure payment is recorded).

### `cancel_order`

Cancels an existing unpaid order and restores inventory if it was deducted.

- **Parameters:** `p_order_id` (UUID)

### `fire_items_v2`

Informs the KDS to start preparing specific items (for multi-course meals).

- **Parameters:** `p_item_ids` (UUID[]), `p_order_id` (UUID)

---

## 📦 Inventory & Suppliers

### `update_inventory_stock`

Manually updates the current stock of an item.

- **Parameters:** `p_item_id` (INTEGER), `p_new_quantity` (NUMERIC), `p_source` (TEXT), `p_employee_name` (TEXT)
- **Logic:** Corrects stock and logs the "who and when" for audit.

### `receive_inventory_shipment`

Processes a supplier delivery (Triple-Check results).

- **Parameters:** `p_items` (JSONB), `p_supplier_id` (INTEGER), `p_invoice_number` (TEXT)
- **Logic:** Increases stock across multiple items in one transaction.

### `close_supplier_order`

Marks a supplier order as fulfilled.

---

## 👥 Customer & Loyalty

### `get_loyalty_balance`

Retrieves a customer's current points/coffee count based on phone number.

- **Parameters:** `p_phone` (TEXT)

### `handle_loyalty_adjustment`

Manual adjustment of loyalty points by a manager.

---

## 📊 Analytics & Monitoring

### `get_sales_data`

Aggregates sales for a specific date range.

- **Parameters:** `p_start_date` (TEXT), `p_end_date` (TEXT)

### `send_kds_heartbeat`

Used by terminals to signal they are online.

- **Parameters:** `p_device_info` (JSONB)

### `get_all_business_stats`

General dashboard statistics (Total sales, unpaid orders, tasks pending).

### `send_device_heartbeat`

Updated to log historical heartbeat events in `device_heartbeat_logs`.

### `get_all_business_stats` (Updated)

Returns business stats including currently active devices with user and IP info.

### `get_device_uptime_stats`

Calculates uptime percentage for devices within business hours.

- **Parameters:** `p_business_id` (UUID), `p_days` (INTEGER)
- **Logic:**
  - Compares active heartbeat minutes against expected business hours.
  - Helps identify Wi-Fi drops or terminal downtime.

---

## 🛠️ Internal & Automation

### `update_recurring_tasks_schedule`

Syncs the weekly plan for recurring tasks (Closing/Opening/Prep).

### `cleanup_items` / `cleanup_duplicates`

Maintenance functions for merging duplicate menu items.

---

**Note:** Most of these functions are defined with `SECURITY DEFINER` to allow terminals (which might have restricted RLS access) to perform critical business operations safely.
