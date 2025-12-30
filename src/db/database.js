/**
 * Dexie.js Database Schema
 * Offline-first local database that mirrors Supabase tables
 * 
 * @module db/database
 */

import Dexie from 'dexie';

// Create database instance
export const db = new Dexie('KDSDatabase');

// Define schema version 1
// Note: Only indexed fields are listed. Other fields (like JSONB mods, settings)
// are stored in the object but not indexed for performance.
db.version(1).stores({
    // Active order items - for real-time KDS display
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',

    // Businesses - multi-tenant support
    businesses: 'id, name',

    // Catalog items (menu items) - for displaying menu
    catalog_items: 'id, name, category, created_at',

    // Customers - for loyalty and order history
    customers: 'id, phone_number, name, business_id',

    // Device sessions - for iPad authentication
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',

    // Discounts - soldier discount, etc.
    discounts: 'id, name, business_id, is_active, discount_code',

    // Employees - for PIN/NFC login
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',

    // Ingredients - for inventory tracking
    ingredients: 'id, name, supplier_id',

    // Orders - full order records
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',

    // Order items - individual items in orders
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',

    // Menu items - full menu catalog
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',

    // Sync metadata - track last sync times
    sync_meta: 'table_name, last_synced_at, record_count'
});

// Version 2: Add offline queue for pending actions
db.version(2).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt'
});

// Version 3: Add option groups and values for modifiers (e.g., milk type, size)
db.version(3).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id'
});

// Version 4: Add loyalty_purchases for coffee/points tracking
db.version(4).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    // Added phone index for quick lookup
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    // NEW: Loyalty purchases (coffee tracking)
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption'
});

// Version 5: Add cached_images for offline menu item pictures
db.version(5).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    offline_queue: 'id, type, status, createdAt',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption',
    // NEW: Cached images for offline menu display
    cached_images: 'url, cached_at'
});

// Version 6: Enhanced sync capabilities
// Added better indexing for queue and new sync_status table
db.version(6).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption',
    cached_images: 'url, cached_at',

    // ENHANCED: detailed queue for generic CRUD actions
    // Renamed to v2 to fix UpgradeError (PK change from id to ++id)
    offline_queue: null, // Drop old table
    offline_queue_v2: '++id, type, status, createdAt, table, recordId',

    // NEW: Per-record sync status for granular conflict resolution
    // _localUpdatedAt and _pendingSync are stored in object but not indexed usually, 
    // unless we need to query by them. unique_id is table+recordId
    sync_status: 'id, table, recordId, status, updated_at'
});

// Version 7: Add _processing index to orders to fix query errors
db.version(7).stores({
    active_order_items: 'id, order_id, menu_item_id, item_status, created_at',
    businesses: 'id, name',
    catalog_items: 'id, name, category, created_at',
    customers: 'id, phone_number, phone, name, business_id',
    device_sessions: 'id, business_id, device_id, employee_id, last_seen_at',
    discounts: 'id, name, business_id, is_active, discount_code',
    employees: 'id, name, nfc_id, pin_code, business_id, auth_user_id',
    ingredients: 'id, name, supplier_id',
    // ADDED _processing here
    orders: 'id, order_number, order_status, is_paid, customer_id, business_id, created_at, updated_at, _processing',
    order_items: 'id, order_id, menu_item_id, item_status, course_stage, created_at',
    menu_items: 'id, name, category, business_id, is_active, kds_routing_logic',
    sync_meta: 'table_name, last_synced_at, record_count',
    optiongroups: 'id, name, menu_item_id, business_id',
    optionvalues: 'id, group_id, value_name, price_adjustment',
    menuitemoptions: 'id, item_id, group_id',
    loyalty_purchases: 'id, customer_id, business_id, created_at, is_redemption',
    cached_images: 'url, cached_at',
    offline_queue: null,
    offline_queue_v2: '++id, type, status, createdAt, table, recordId',
    sync_status: 'id, table, recordId, status, updated_at'
});

// Export table references for easy access
export const {
    active_order_items,
    businesses,
    catalog_items,
    customers,
    device_sessions,
    discounts,
    employees,
    ingredients,
    orders,
    order_items,
    menu_items,
    sync_meta,
    cached_images
} = db;

// Database health check
export const isDatabaseReady = async () => {
    try {
        await db.open();
        return true;
    } catch (error) {
        console.error('❌ Dexie database failed to open:', error);
        return false;
    }
};

// Clear all data (for debugging/logout)
export const clearAllData = async () => {
    await db.transaction('rw', db.tables, async () => {
        for (const table of db.tables) {
            await table.clear();
        }
    });
    console.log('🗑️ All local data cleared');
};

// Get sync status for all tables
export const getSyncStatus = async () => {
    const status = await sync_meta.toArray();
    return status.reduce((acc, item) => {
        acc[item.table_name] = {
            lastSynced: item.last_synced_at,
            recordCount: item.record_count
        };
        return acc;
    }, {});
};

export default db;
