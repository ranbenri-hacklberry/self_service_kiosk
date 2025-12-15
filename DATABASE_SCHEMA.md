# Database Schema Reference - iCaffe

## Complete Database Schema

### Table Structure Overview:
```
customers (id, phone_number, name, loyalty_coffee_count)
    ↓
orders (id, order_number, customer_id, order_status, is_paid, payment_method, ...)
    ↓
order_items (id, order_id, menu_item_id, quantity, mods, item_status, ...)
    ↓
menu_items (id, name, category, price, is_prep_required, ...)
    ↓
menuitemoptions (item_id, group_id)
    ↓
optiongroups (id, name/group_name, is_required, is_multiple_select, ...)
    ↓
optionvalues (id, group_id, value_name, price_adjustment, ...)
```

---

## Core Tables

### 1. `menu_items`
**Primary Key:** `id` (INTEGER)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary Key |
| `name` | TEXT | Item name (Hebrew) |
| `category` | TEXT | Item category |
| `price` | NUMERIC | Base price |
| `is_prep_required` | BOOLEAN | Whether item requires preparation |

**Important Item IDs:**
- **10** - אספרסו קצר
- **11** - אספרסו כפול
- **20** - קפה שחור
- **19** - נס על חלב
- **22** - קפה קר

---

### 2. `menuitemoptions`
**Primary Key:** Composite (`item_id`, `group_id`)

| Column | Type | Description |
|--------|------|-------------|
| `item_id` | INTEGER | FK to `menu_items.id` |
| `group_id` | UUID | FK to `optiongroups.id` |

**Relationships:**
- `item_id` → `menu_items.id`
- `group_id` → `optiongroups.id`

---

### 3. `optiongroups`
**Primary Key:** `id` (UUID)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `name` / `group_name` | TEXT | Group name (both column names used) |
| `is_required` | BOOLEAN | Whether selection is required |
| `is_multiple_select` | BOOLEAN | Allow multiple selections |
| `display_order` | INTEGER | Display order |

---

### 4. `optionvalues`
**Primary Key:** `id` (UUID)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `group_id` | UUID | FK to `optiongroups.id` |
| `value_name` | TEXT | Option value name (Hebrew) |
| `price_adjustment` | NUMERIC | Price modifier (can be negative) |
| `display_order` | INTEGER | Display order |
| `is_default` | BOOLEAN | Default selection |

**Relationships:**
- `group_id` → `optiongroups.id`

---

### 5. `customers`
**Primary Key:** `id` (UUID or INTEGER)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID/INTEGER | Primary Key |
| `phone_number` | TEXT | Customer phone number (unique) |
| `name` | TEXT | Customer name |
| `loyalty_coffee_count` | INTEGER | Loyalty program coffee count |

**Functions:**
- `upsert_customer(p_phone_number, p_name)` - Upsert customer by phone

---

### 6. `orders`
**Primary Key:** `id` (UUID)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key |
| `order_number` | TEXT | Human-readable order number |
| `customer_id` | UUID/INTEGER | FK to `customers.id` (nullable) |
| `customer_name` | TEXT | Customer name (for guest orders) |
| `order_status` | TEXT | Status: `pending`, `in_progress`, `ready`, `completed` |
| `is_paid` | BOOLEAN | Payment status |
| `payment_method` | TEXT | `cash`, `credit`, etc. |
| `created_at` | TIMESTAMP | Order creation time |
| `total` | NUMERIC | Order total amount |
| `isRefund` | BOOLEAN | Whether this is a refund order |
| `refundAmount` | NUMERIC | Refund amount (if applicable) |

**Relationships:**
- `customer_id` → `customers.id`

**Status Flow:**
- `pending` → `in_progress` → `ready` → `completed`

---

### 7. `order_items`
**Primary Key:** `id` (UUID or INTEGER)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID/INTEGER | Primary Key |
| `order_id` | UUID | FK to `orders.id` |
| `menu_item_id` / `item_id` | INTEGER | FK to `menu_items.id` |
| `quantity` | INTEGER | Item quantity |
| `mods` | JSON/TEXT | Selected modifiers (array of value IDs or objects) |
| `item_status` | TEXT | Status: `pending`, `in_progress`, `ready`, `cancelled`, `closed` |
| `price` | NUMERIC | Item price (with modifiers) |

**Relationships:**
- `order_id` → `orders.id`
- `menu_item_id` → `menu_items.id`

**Note:** `mods` can be:
- JSON array of value IDs: `[uuid1, uuid2, ...]`
- JSON object: `{group_id: value_id, ...}`
- String representation of above

---

### 8. `employees`
**Primary Key:** `id` (INTEGER or UUID)

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER/UUID | Primary Key |
| `name` | TEXT | Employee name |
| `pin_code` | TEXT | PIN for login |
| `access_level` | TEXT | `Employee`, `Manager`, `Admin` |
| `created_at` | TIMESTAMP | Creation time |

---

### 9. `time_clock_events`
**Primary Key:** `id` (UUID or INTEGER)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID/INTEGER | Primary Key |
| `employee_id` | INTEGER/UUID | FK to `employees.id` |
| `event_type` | TEXT | `clock_in`, `clock_out` |
| `event_time` | TIMESTAMP | Event timestamp |

**Relationships:**
- `employee_id` → `employees.id`

---

### 10. `supplier_orders`
**Primary Key:** `id` (UUID or INTEGER)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID/INTEGER | Primary Key |
| *(Additional columns inferred from usage)* | | |

---

### 11. `user_profiles`
**Primary Key:** `id` (UUID)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key (matches auth.users.id) |
| *(Additional profile columns)* | | |

---

## Common Queries

### Get all modifiers for a menu item:
```sql
SELECT 
    mi.name as item_name,
    og.name as group_name,
    ov.value_name,
    ov.price_adjustment
FROM menu_items mi
JOIN menuitemoptions mio ON mi.id = mio.item_id
JOIN optiongroups og ON mio.group_id = og.id
JOIN optionvalues ov ON og.id = ov.group_id
WHERE mi.id = [ITEM_ID]
ORDER BY og.display_order, ov.display_order;
```

### Get order with items and modifiers:
```sql
SELECT 
    o.id,
    o.order_number,
    o.order_status,
    o.is_paid,
    o.customer_name,
    oi.id as item_id,
    oi.quantity,
    oi.mods,
    oi.item_status,
    mi.name as item_name,
    mi.price as base_price
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN menu_items mi ON oi.menu_item_id = mi.id
WHERE o.id = '[ORDER_ID]'
ORDER BY o.created_at DESC, oi.id;
```

### Remove all modifiers from an item:
```sql
DELETE FROM menuitemoptions WHERE item_id = [ITEM_ID];
```

### Get customer with recent orders:
```sql
SELECT 
    c.id,
    c.name,
    c.phone_number,
    c.loyalty_coffee_count,
    o.id as order_id,
    o.order_number,
    o.created_at
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE c.phone_number = '[PHONE_NUMBER]'
ORDER BY o.created_at DESC
LIMIT 10;
```

---

## Key Relationships Summary

1. **Menu System:**
   - `menu_items` → `menuitemoptions` → `optiongroups` → `optionvalues`

2. **Order System:**
   - `customers` → `orders` → `order_items` → `menu_items`

3. **Employee System:**
   - `employees` → `time_clock_events`

---

## Notes

- Column names may vary: `group_name` vs `name` in `optiongroups`
- `mods` field in `order_items` can be stored as JSON string or JSONB
- Order statuses follow a specific flow: `pending` → `in_progress` → `ready` → `completed`
- Item statuses in `order_items` can be: `pending`, `in_progress`, `ready`, `cancelled`, `closed`
- UUIDs are used for most primary keys, but some tables use INTEGER IDs

---
**Last updated:** 2025-01-XX (comprehensive schema)
