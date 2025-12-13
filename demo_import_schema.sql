-- ============================================
-- DEMO DATABASE IMPORT SCRIPT
-- Run in Demo (bezyhnewyzwkgnrvnqli)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- DROP EXISTING TABLES (if any)
-- ============================================
DROP TABLE IF EXISTS menuitemoptions CASCADE;
DROP TABLE IF EXISTS optionvalues CASCADE;
DROP TABLE IF EXISTS optiongroups CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS loyalty_cards CASCADE;
DROP TABLE IF EXISTS time_clock_events CASCADE;
DROP TABLE IF EXISTS employees CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS supplier_order_items CASCADE;
DROP TABLE IF EXISTS supplier_orders CASCADE;
DROP TABLE IF EXISTS supplier_menu_item CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS recipe_ingredients CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS prepared_items_inventory CASCADE;
DROP TABLE IF EXISTS prepbatches CASCADE;
DROP TABLE IF EXISTS inventory_logs CASCADE;
DROP TABLE IF EXISTS inventory_items CASCADE;
DROP TABLE IF EXISTS ingredients CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS recurring_tasks CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;

-- ============================================
-- CREATE SEQUENCES
-- ============================================
CREATE SEQUENCE IF NOT EXISTS ingredients_id_seq;
CREATE SEQUENCE IF NOT EXISTS inventory_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS inventory_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS menu_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS recipe_ingredients_id_seq;
CREATE SEQUENCE IF NOT EXISTS recipes_id_seq;
CREATE SEQUENCE IF NOT EXISTS recurring_tasks_id_seq;
CREATE SEQUENCE IF NOT EXISTS supplier_order_items_id_seq;
CREATE SEQUENCE IF NOT EXISTS supplier_orders_id_seq;
CREATE SEQUENCE IF NOT EXISTS suppliers_id_seq;
CREATE SEQUENCE IF NOT EXISTS tasks_id_seq;

-- ============================================
-- CREATE ALL TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS public.customers (id uuid NOT NULL DEFAULT gen_random_uuid(), phone_number text NOT NULL, name text, loyalty_coffee_count integer NOT NULL DEFAULT 0, created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), updated_at date);

CREATE TABLE IF NOT EXISTS public.employees (id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, nfc_id text, pin_code text, access_level text NOT NULL DEFAULT 'Worker'::text, created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), whatsapp_phone text, is_admin boolean NOT NULL DEFAULT false, email text);

CREATE TABLE IF NOT EXISTS public.ingredients (id integer NOT NULL DEFAULT nextval('ingredients_id_seq'::regclass), name text NOT NULL, unit text NOT NULL, current_stock numeric DEFAULT 0, min_stock numeric DEFAULT 0, supplier_id integer, purchase_unit_quantity integer DEFAULT 1, purchase_unit_name text DEFAULT 'יחידה'::text, purchase_price numeric(10,4) DEFAULT 0, unit_of_measure text DEFAULT 'יחידה'::text, reorder_point integer DEFAULT 0);

CREATE TABLE IF NOT EXISTS public.inventory_items (id integer NOT NULL DEFAULT nextval('inventory_items_id_seq'::regclass), created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), name text NOT NULL, category text NOT NULL, unit text NOT NULL, current_stock numeric DEFAULT 0, cost_per_unit numeric DEFAULT 0, low_stock_alert numeric DEFAULT 5, supplier text, case_quantity integer DEFAULT 1, supplier_id bigint);

CREATE TABLE IF NOT EXISTS public.inventory_logs (id integer NOT NULL DEFAULT nextval('inventory_logs_id_seq'::regclass), inventory_item_id integer, count_timestamp timestamp with time zone DEFAULT now(), physical_count integer NOT NULL, system_estimate integer, adjustment_amount integer, employee_id integer, log_type text NOT NULL, notes text, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.loyalty_cards (id uuid NOT NULL DEFAULT gen_random_uuid(), customer_phone text NOT NULL, points_balance integer DEFAULT 0, total_free_coffees_redeemed integer DEFAULT 0, last_updated timestamp with time zone DEFAULT now(), created_at timestamp with time zone DEFAULT now(), free_coffees integer DEFAULT 0, total_coffees_purchased integer DEFAULT 0);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (id uuid NOT NULL DEFAULT gen_random_uuid(), card_id uuid, order_id uuid, change_amount integer NOT NULL, transaction_type text NOT NULL, created_at timestamp with time zone DEFAULT now(), points_earned integer DEFAULT 0, points_redeemed integer DEFAULT 0, created_by uuid);

CREATE TABLE IF NOT EXISTS public.menu_items (id integer NOT NULL DEFAULT nextval('menu_items_id_seq'::regclass), name text NOT NULL, price numeric NOT NULL, category text NOT NULL, image_url text, is_prep_required boolean NOT NULL DEFAULT true, kds_routing_logic text DEFAULT 'GRAB_AND_GO'::text, description text, is_in_stock boolean DEFAULT true, allow_notes boolean DEFAULT true);

CREATE TABLE IF NOT EXISTS public.menuitemoptions (item_id integer NOT NULL, group_id uuid NOT NULL);

CREATE TABLE IF NOT EXISTS public.optiongroups (id uuid NOT NULL DEFAULT uuid_generate_v4(), name text NOT NULL, display_order integer DEFAULT 0, is_required boolean DEFAULT false, is_multiple_select boolean DEFAULT false);

CREATE TABLE IF NOT EXISTS public.optionvalues (id uuid NOT NULL DEFAULT uuid_generate_v4(), group_id uuid, value_name text NOT NULL, price_adjustment numeric DEFAULT 0.00, display_order integer DEFAULT 0, is_default boolean DEFAULT false);

CREATE TABLE IF NOT EXISTS public.order_items (id uuid NOT NULL DEFAULT gen_random_uuid(), order_id uuid, menu_item_id integer, quantity integer NOT NULL DEFAULT 1, mods jsonb, item_status text NOT NULL DEFAULT 'new'::text, created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), updated_at timestamp with time zone DEFAULT now(), price numeric DEFAULT 0, notes text, course_stage integer DEFAULT 1, item_fired_at timestamp with time zone);

CREATE TABLE IF NOT EXISTS public.orders (id uuid NOT NULL DEFAULT gen_random_uuid(), order_number bigint, customer_phone text, customer_name text, order_status text NOT NULL DEFAULT 'new'::text, is_paid boolean NOT NULL DEFAULT false, customer_id uuid, created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()), payment_method text, total_amount numeric(10,2), is_refund boolean DEFAULT false, refund_amount numeric DEFAULT 0, ready_at timestamp with time zone, completed_at timestamp with time zone, fired_at timestamp with time zone);

CREATE TABLE IF NOT EXISTS public.prepared_items_inventory (item_id integer NOT NULL, initial_stock real NOT NULL, current_stock real NOT NULL, unit text, last_updated timestamp with time zone DEFAULT timezone('utc'::text, now()));

CREATE TABLE IF NOT EXISTS public.prepbatches (id uuid NOT NULL DEFAULT uuid_generate_v4(), recipe_id uuid, batch_size numeric NOT NULL, unit_of_measure text NOT NULL, prep_status text NOT NULL DEFAULT 'ממתין'::text, prepared_by uuid, inventory_deducted boolean DEFAULT false, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), status text DEFAULT 'pending'::text, completed_at timestamp with time zone);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (id integer NOT NULL DEFAULT nextval('recipe_ingredients_id_seq'::regclass), recipe_id integer NOT NULL, inventory_item_id integer NOT NULL, quantity_used numeric NOT NULL, unit_of_measure text NOT NULL, created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));

CREATE TABLE IF NOT EXISTS public.recipes (id integer NOT NULL DEFAULT nextval('recipes_id_seq'::regclass), menu_item_id integer, instructions text, preparation_quantity real NOT NULL, quantity_unit text, task_id integer);

CREATE TABLE IF NOT EXISTS public.recurring_tasks (id integer NOT NULL DEFAULT nextval('recurring_tasks_id_seq'::regclass), name text NOT NULL, description text, category text NOT NULL, frequency text NOT NULL DEFAULT 'Daily'::text, day_of_week integer, due_time time without time zone, is_active boolean DEFAULT true, recipe_id integer, menu_item_id integer, quantity integer DEFAULT 1);

CREATE TABLE IF NOT EXISTS public.supplier_menu_item (supplier_id integer NOT NULL, menu_item_id integer NOT NULL);

CREATE TABLE IF NOT EXISTS public.supplier_order_items (id integer NOT NULL DEFAULT nextval('supplier_order_items_id_seq'::regclass), supplier_order_id integer, inventory_item_id integer, ordered_quantity_units integer NOT NULL, ordered_unit_name text, received_quantity_units integer, received_date timestamp with time zone, unit_price numeric(10,2), line_item_status text NOT NULL DEFAULT 'EXPECTED'::text, created_at timestamp with time zone DEFAULT now(), quantity numeric DEFAULT 1);

CREATE TABLE IF NOT EXISTS public.supplier_orders (id integer NOT NULL DEFAULT nextval('supplier_orders_id_seq'::regclass), supplier_id integer, order_date date NOT NULL DEFAULT CURRENT_DATE, expected_delivery_date date, order_status text NOT NULL DEFAULT 'PENDING'::text, created_by_employee_id integer, total_amount numeric(10,2), created_at timestamp with time zone DEFAULT now(), delivery_status text DEFAULT 'pending'::text, invoice_image_url text, confirmed_at timestamp with time zone, confirmed_by uuid, status text DEFAULT 'sent'::text);

CREATE TABLE IF NOT EXISTS public.suppliers (id integer NOT NULL DEFAULT nextval('suppliers_id_seq'::regclass), name text NOT NULL, contact_person text, phone_number text, email text, notes text, delivery_days text);

CREATE TABLE IF NOT EXISTS public.tasks (id integer NOT NULL DEFAULT nextval('tasks_id_seq'::regclass), description text NOT NULL, category text, status text NOT NULL DEFAULT 'Pending'::text, due_date timestamp with time zone, created_at timestamp with time zone DEFAULT timezone('utc'::text, now()), menu_item_id integer, quantity integer DEFAULT 1);

CREATE TABLE IF NOT EXISTS public.time_clock_events (id uuid NOT NULL DEFAULT gen_random_uuid(), employee_id uuid, event_type text NOT NULL, event_time timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()));

-- ============================================
-- ADD PRIMARY KEYS
-- ============================================
ALTER TABLE customers ADD PRIMARY KEY (id);
ALTER TABLE employees ADD PRIMARY KEY (id);
ALTER TABLE ingredients ADD PRIMARY KEY (id);
ALTER TABLE inventory_items ADD PRIMARY KEY (id);
ALTER TABLE inventory_logs ADD PRIMARY KEY (id);
ALTER TABLE loyalty_cards ADD PRIMARY KEY (id);
ALTER TABLE loyalty_transactions ADD PRIMARY KEY (id);
ALTER TABLE menu_items ADD PRIMARY KEY (id);
ALTER TABLE menuitemoptions ADD PRIMARY KEY (item_id, group_id);
ALTER TABLE optiongroups ADD PRIMARY KEY (id);
ALTER TABLE optionvalues ADD PRIMARY KEY (id);
ALTER TABLE order_items ADD PRIMARY KEY (id);
ALTER TABLE orders ADD PRIMARY KEY (id);
ALTER TABLE prepared_items_inventory ADD PRIMARY KEY (item_id);
ALTER TABLE prepbatches ADD PRIMARY KEY (id);
ALTER TABLE recipe_ingredients ADD PRIMARY KEY (id);
ALTER TABLE recipes ADD PRIMARY KEY (id);
ALTER TABLE recurring_tasks ADD PRIMARY KEY (id);
ALTER TABLE supplier_menu_item ADD PRIMARY KEY (supplier_id, menu_item_id);
ALTER TABLE supplier_order_items ADD PRIMARY KEY (id);
ALTER TABLE supplier_orders ADD PRIMARY KEY (id);
ALTER TABLE suppliers ADD PRIMARY KEY (id);
ALTER TABLE tasks ADD PRIMARY KEY (id);
ALTER TABLE time_clock_events ADD PRIMARY KEY (id);

-- ============================================
-- ADD UNIQUE CONSTRAINTS
-- ============================================
ALTER TABLE customers ADD CONSTRAINT customers_phone_number_key UNIQUE (phone_number);
ALTER TABLE loyalty_cards ADD CONSTRAINT loyalty_cards_customer_phone_key UNIQUE (customer_phone);

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
SELECT 'Schema created successfully! Now import menu data.' as status;
