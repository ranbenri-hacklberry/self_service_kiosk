-- Demo Import: Suppliers
-- Run this in the Demo project SQL Editor after demo_import_inventory.sql

-- Clear existing data
TRUNCATE TABLE suppliers CASCADE;

-- Insert suppliers
INSERT INTO suppliers (id, name, contact_person, phone_number, email, notes, delivery_days) VALUES
(1, 'ביסקוטי', NULL, NULL, NULL, 'ספק בלעדי לכל הקינוחים.', NULL),
(2, 'כוכב השחר', NULL, NULL, NULL, NULL, NULL),
(3, 'פיצה מרקט', NULL, NULL, NULL, NULL, NULL),
(5, 'ברכת האדמה', NULL, NULL, NULL, NULL, NULL);

-- Reset sequence to max id + 1
SELECT setval('suppliers_id_seq', 5, true);

-- Verify import
SELECT COUNT(*) as supplier_count FROM suppliers;
