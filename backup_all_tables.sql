-- ============================================
-- BACKUP SCRIPT - Export all important data
-- Run each query and save results as JSON
-- ============================================

-- 1. CUSTOMERS
SELECT json_agg(t) FROM customers t;

-- 2. ORDERS  
SELECT json_agg(t) FROM orders t;

-- 3. ORDER_ITEMS
SELECT json_agg(t) FROM order_items t;

-- 4. MENU_ITEMS
SELECT json_agg(t) FROM menu_items t;

-- 5. EMPLOYEES
SELECT json_agg(t) FROM employees t;

-- 6. LOYALTY_TRANSACTIONS
SELECT json_agg(t) FROM loyalty_transactions t;

-- 7. LOYALTY_CARDS
SELECT json_agg(t) FROM loyalty_cards t;

-- 8. INVENTORY_ITEMS
SELECT json_agg(t) FROM inventory_items t;

-- 9. SUPPLIERS
SELECT json_agg(t) FROM suppliers t;

-- 10. OPTIONGROUPS
SELECT json_agg(t) FROM optiongroups t;

-- 11. OPTIONVALUES
SELECT json_agg(t) FROM optionvalues t;

-- 12. MENUITEMOPTIONS
SELECT json_agg(t) FROM menuitemoptions t;

-- 13. TASKS
SELECT json_agg(t) FROM tasks t;

-- 14. RECURRING_TASKS
SELECT json_agg(t) FROM recurring_tasks t;

-- 15. TIME_CLOCK_EVENTS
SELECT json_agg(t) FROM time_clock_events t;
