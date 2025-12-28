/**
 * Supabase → Dexie Sync Service
 * Handles data synchronization between Supabase (cloud) and Dexie (local)
 * 
 * ⚠️ IMPORTANT: RLS (Row Level Security) is ALWAYS enabled on Supabase!
 * This is a multi-tenant application. If data is not syncing:
 * 1. FIRST check RLS policies in Supabase Dashboard
 * 2. Verify the user's business_id matches the data
 * 3. Check if the auth token is being sent correctly
 * 
 * @module services/syncService
 */

import { db, sync_meta } from '../db/database';
import { supabase } from '../lib/supabase';

// Sync configuration
const SYNC_CONFIG = {
    // Tables to sync with their Supabase table names and optional filters
    tables: [
        { local: 'businesses', remote: 'businesses' },
        { local: 'menu_items', remote: 'menu_items' },
        { local: 'customers', remote: 'customers' },
        { local: 'employees', remote: 'employees' },
        { local: 'discounts', remote: 'discounts' },
        { local: 'ingredients', remote: 'ingredients' },
        { local: 'orders', remote: 'orders', filter: { column: 'created_at', op: 'gte', value: 'today' } },
        { local: 'order_items', remote: 'order_items' },
        // Option groups and values for modifiers (milk type, size, etc.)
        { local: 'optiongroups', remote: 'optiongroups' },
        { local: 'optionvalues', remote: 'optionvalues' },
        { local: 'menuitemoptions', remote: 'menuitemoptions' },
        // Note: loyalty_purchases table doesn't exist in Supabase yet
    ],
    // How many records to fetch per batch
    batchSize: 1000,
};

/**
 * Check if device is online
 */
export const isOnline = () => {
    return navigator.onLine;
};

/**
 * Sync a single table from Supabase to Dexie
 * @param {string} localTable - Local Dexie table name
 * @param {string} remoteTable - Remote Supabase table name
 * @param {Object} filter - Optional filter for the query
 * @param {string} businessId - Business ID for multi-tenant filtering
 */
export const syncTable = async (localTable, remoteTable, filter = null, businessId = null) => {
    if (!isOnline()) {
        console.log(`⏸️ Offline - skipping sync for ${localTable}`);
        return { success: false, reason: 'offline' };
    }

    try {
        console.log(`🔄 Syncing ${localTable}...`);

        // Build query
        let query = supabase.from(remoteTable).select('*');

        // Apply business filter only for multi-tenant tables
        // NOTE: ingredients does NOT have business_id column
        const multiTenantTables = ['menu_items', 'customers', 'employees', 'discounts', 'orders'];
        if (businessId && multiTenantTables.includes(remoteTable)) {
            query = query.eq('business_id', businessId);
        }

        // Apply date filter for orders (only today's orders)
        if (filter && filter.column === 'created_at' && filter.value === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            query = query.gte('created_at', today.toISOString());
        }

        // Fetch data
        const { data, error } = await query.limit(SYNC_CONFIG.batchSize);

        if (error) {
            console.error(`❌ Sync error for ${localTable}:`, error.message, error);
            return { success: false, error: error.message };
        }

        // DIAGNOSTIC: For orders, log detailed info
        if (localTable === 'orders') {
            console.log(`📊 Orders sync result: ${data?.length || 0} records. Query used businessId: ${businessId}, date filter: today`);
            if (data && data.length > 0) {
                console.log(`📊 Sample order IDs: ${data.slice(0, 3).map(o => o.id).join(', ')}`);
            }
        }

        if (!data || data.length === 0) {
            console.log(`📭 No data for ${localTable}`);
            return { success: true, count: 0 };
        }

        // Fix for tables that might not have an 'id' field (like menuitemoptions)
        // Generate a unique id if missing
        const dataWithIds = data.map((record, index) => {
            if (!record.id) {
                // Create a composite key from available fields
                const compositeId = `${record.item_id || ''}_${record.group_id || ''}_${index}`;
                return { ...record, id: compositeId };
            }
            return record;
        });

        // Bulk upsert into Dexie
        await db[localTable].bulkPut(dataWithIds);

        // Update sync metadata
        await sync_meta.put({
            table_name: localTable,
            last_synced_at: new Date().toISOString(),
            record_count: dataWithIds.length
        });

        console.log(`✅ Synced ${dataWithIds.length} records to ${localTable}`);
        return { success: true, count: dataWithIds.length };

    } catch (err) {
        console.error(`❌ Sync failed for ${localTable}:`, err);
        return { success: false, error: err };
    }
};

/**
 * Initial load - hydrate all tables from Supabase
 * Call this on app startup when iPad comes online
 * @param {string} businessId - The business ID to filter data
 */
export const initialLoad = async (businessId) => {
    if (!isOnline()) {
        console.log('⏸️ Device is offline - using cached data');
        return { success: false, reason: 'offline' };
    }

    console.log('🚀 Starting initial data load...');
    const startTime = Date.now();
    const results = {};

    for (const table of SYNC_CONFIG.tables) {
        const result = await syncTable(table.local, table.remote, table.filter, businessId);
        results[table.local] = result;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Initial load complete in ${duration}s`, results);

    return { success: true, results, duration };
};

/**
 * Sync orders and order items (real-time sync for KDS)
 * @param {string} businessId - Business ID
 */
export const syncOrders = async (businessId) => {
    if (!isOnline()) {
        return { success: false, reason: 'offline' };
    }

    // Get today's orders
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('business_id', businessId)
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

    if (ordersError) {
        console.error('❌ Orders sync error:', ordersError);
        return { success: false, error: ordersError };
    }

    if (orders && orders.length > 0) {
        await db.orders.bulkPut(orders);

        // Get order items for these orders
        const orderIds = orders.map(o => o.id);
        const { data: items, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds);

        if (!itemsError && items) {
            await db.order_items.bulkPut(items);
        }

        console.log(`✅ Synced ${orders.length} orders, ${items?.length || 0} items`);
    }

    return { success: true, ordersCount: orders?.length || 0 };
};

/**
 * Push local changes to Supabase (for when coming back online)
 * This handles offline-created orders
 */
export const pushPendingChanges = async () => {
    // TODO: Implement offline queue for orders created while offline
    // For now, KDS is read-only when offline
    console.log('📤 Push pending changes - not implemented yet');
    return { success: true, pending: 0 };
};

/**
 * Setup real-time subscription for orders
 * @param {string} businessId - Business ID
 * @param {Function} onUpdate - Callback when orders change
 */
export const subscribeToOrders = (businessId, onUpdate) => {
    const subscription = supabase
        .channel('orders-sync')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'orders',
                filter: `business_id=eq.${businessId}`
            },
            async (payload) => {
                console.log('📡 Order change detected:', payload.eventType);

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.orders.put(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    await db.orders.delete(payload.old.id);
                }

                onUpdate?.(payload);
            }
        )
        .subscribe();

    return subscription;
};

/**
 * Subscribe to order items changes
 */
export const subscribeToOrderItems = (businessId, onUpdate) => {
    const subscription = supabase
        .channel('order-items-sync')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'order_items'
            },
            async (payload) => {
                console.log('📡 Order item change detected:', payload.eventType);

                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    await db.order_items.put(payload.new);
                } else if (payload.eventType === 'DELETE') {
                    await db.order_items.delete(payload.old.id);
                }

                onUpdate?.(payload);
            }
        )
        .subscribe();

    return subscription;
};

export default {
    isOnline,
    syncTable,
    initialLoad,
    syncOrders,
    pushPendingChanges,
    subscribeToOrders,
    subscribeToOrderItems
};
