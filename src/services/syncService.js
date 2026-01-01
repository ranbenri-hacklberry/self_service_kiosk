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
        // Loyalty tracking
        { local: 'loyalty_cards', remote: 'loyalty_cards' },
        { local: 'loyalty_transactions', remote: 'loyalty_transactions' },
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

        // Special handling for customers - use RPC to bypass RLS
        if (remoteTable === 'customers' && businessId) {
            console.log(`🔄 Using RPC for customers sync...`);
            const { data, error } = await supabase.rpc('get_customers_for_sync', {
                p_business_id: businessId
            });

            if (!error && data) {
                await db[localTable].bulkPut(data);
                return { success: true, count: data.length };
            }
        }

        // Special handling for loyalty_cards - use RPC
        if (remoteTable === 'loyalty_cards' && businessId) {
            console.log(`🔄 Using RPC for loyalty_cards sync...`);
            const { data, error } = await supabase.rpc('get_loyalty_cards_for_sync', {
                p_business_id: businessId
            });

            if (!error && data) {
                await db[localTable].bulkPut(data);
                return { success: true, count: data.length };
            }
        }

        // Special handling for loyalty_transactions - use RPC
        if (remoteTable === 'loyalty_transactions' && businessId) {
            console.log(`🔄 Using RPC for loyalty_transactions sync...`);
            const { data, error } = await supabase.rpc('get_loyalty_transactions_for_sync', {
                p_business_id: businessId
            });

            if (!error && data) {
                await db[localTable].bulkPut(data);
                return { success: true, count: data.length };
            }
        }

        // Build query
        let query = supabase.from(remoteTable).select('*');

        // Apply business filter only for multi-tenant tables
        // NOTE: ingredients does NOT have business_id column
        // businesses table is NOT filtered (it's a lookup table)
        const multiTenantTables = [
            'menu_items',
            'customers',
            'employees',
            'discounts',
            'orders',
            'optiongroups',
            'loyalty_cards'
        ];
        if (businessId && multiTenantTables.includes(remoteTable)) {
            query = query.eq('business_id', businessId);
        }

        // Special handling for optionvalues and menuitemoptions
        // These tables are small (< 500 rows), so we fetch ALL of them to ensure no linking issues.
        // Complex filtering by group_id was causing sync failures when groups weren't found correctly.
        if (remoteTable === 'optionvalues' || remoteTable === 'menuitemoptions') {
            console.log(`🌍 Fetching ALL ${remoteTable} (small table optimization)...`);
            // Do NOT filter by business_id or group_id
        }
        else if (businessId && multiTenantTables.includes(remoteTable)) {
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
export const initialLoad = async (businessId, onProgress = null) => {
    if (!isOnline()) {
        console.log('⏸️ Device is offline - using cached data');
        return { success: false, reason: 'offline' };
    }

    console.log('🚀 Starting initial data load...');
    const startTime = Date.now();
    const results = {};
    const totalTables = SYNC_CONFIG.tables.length;

    for (let i = 0; i < SYNC_CONFIG.tables.length; i++) {
        const table = SYNC_CONFIG.tables[i];
        const result = await syncTable(table.local, table.remote, table.filter, businessId);
        results[table.local] = result;

        // Calculate and report progress
        const progress = Math.round(((i + 1) / totalTables) * 100);
        console.log(`📊 Sync progress: ${progress}% (${i + 1}/${totalTables}) - ${table.local}`);

        // Call progress callback if provided
        if (onProgress) {
            onProgress(table.local, result.count || 0, progress);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Initial load complete in ${duration}s`, results);

    return { success: true, results, duration };
};

/**
 * Sync orders and order items (real-time sync for KDS)
 * Uses RPC to bypass RLS restrictions
 * @param {string} businessId - Business ID
 */
export const syncOrders = async (businessId) => {
    console.log('🔍 [syncOrders] Starting sync for businessId:', businessId);

    if (!isOnline()) {
        console.log('📴 [syncOrders] Offline, skipping sync');
        return { success: false, reason: 'offline' };
    }

    // Use date from 30 days ago to get full history
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30); // 30 days of history
    const fromDateISO = fromDate.toISOString();
    const toDateISO = new Date().toISOString();

    console.log('📅 [syncOrders] Filtering from:', fromDateISO, 'to:', toDateISO);

    try {
        // Use get_orders_history RPC to get ALL orders (not just active)
        const { data: ordersData, error: ordersError } = await supabase.rpc('get_orders_history', {
            p_from_date: fromDateISO,
            p_to_date: toDateISO,
            p_business_id: businessId
        });

        // RPC returns JSONB, parse if needed
        const orders = Array.isArray(ordersData) ? ordersData : (ordersData || []);

        console.log('📦 [syncOrders] RPC response:', {
            ordersCount: orders?.length,
            hasError: !!ordersError,
            error: ordersError
        });

        if (ordersError) {
            console.error('❌ Orders sync error:', ordersError);
            return { success: false, error: ordersError };
        }

        if (orders && orders.length > 0) {
            console.log(`💾 [syncOrders] Saving ${orders.length} orders to Dexie (bulk)...`);

            // Prepare bulk arrays
            const ordersToSave = [];
            const itemsToSave = [];

            for (const order of orders) {
                // RPC uses 'items_detail', local expects 'order_items'
                const orderItems = order.order_items || order.items_detail || [];

                ordersToSave.push({
                    id: order.id,
                    order_number: order.order_number,
                    order_status: order.order_status,
                    is_paid: order.is_paid,
                    customer_id: order.customer_id,
                    customer_name: order.customer_name,
                    customer_phone: order.customer_phone,
                    total_amount: order.total_amount,
                    business_id: order.business_id || businessId,
                    created_at: order.created_at,
                    updated_at: order.updated_at || new Date().toISOString()
                });

                // Collect items
                for (const item of orderItems) {
                    itemsToSave.push({
                        id: item.id,
                        order_id: order.id,
                        menu_item_id: item.menu_item_id || item.menu_items?.id,
                        quantity: item.quantity,
                        price: item.price,
                        mods: item.mods,
                        notes: item.notes,
                        item_status: item.item_status,
                        course_stage: item.course_stage || 1,
                        created_at: item.created_at || order.created_at
                    });
                }
            }

            // Bulk save (much faster!)
            await db.orders.bulkPut(ordersToSave);
            console.log(`✅ Saved ${ordersToSave.length} orders`);

            if (itemsToSave.length > 0) {
                await db.order_items.bulkPut(itemsToSave);
                console.log(`✅ Saved ${itemsToSave.length} items`);
            }

            console.log(`✅ Synced ${orders.length} orders to Dexie`);
        } else {
            console.log('📭 [syncOrders] No orders found matching criteria');
        }

        return { success: true, ordersCount: orders?.length || 0 };

    } catch (err) {
        console.error('❌ syncOrders exception:', err);
        return { success: false, error: err.message };
    }
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

/**
 * Subscribe to ALL table changes for a business
 * Updates Dexie immediately when remote changes detected
 * Respects local pending changes to prevent overwrites (Last-Write-Wins check)
 */
export const subscribeToAllChanges = (businessId, tables = ['orders', 'order_items', 'menu_items', 'customers', 'employees', 'discounts', 'ingredients']) => {
    const subscriptions = [];

    // Cleanup any existing? usually this is called once on mount
    console.log(`🔌 Subscribing to Realtime changes for: ${tables.join(', ')}`);

    for (const table of tables) {
        const channel = supabase
            .channel(`${table}-sync-${businessId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table,
                    // Filter by business_id for all tables except order_items (which doesn't have it directly usually, or we rely on RLS/cascade)
                    // Actually order_items doesn't have business_id in schema usually, it's joined. 
                    // But Supabase Realtime filters must match column existence. 
                    // We'll filter client-side for order_items if needed or rely on the Fact that we only get what we can see (RLS).
                    // However, 'postgres_changes' ignores RLS for subscription *filters* often, but receives RLS'd rows? 
                    // Safest is to specific filter if column exists.
                    filter: (table !== 'order_items' && table !== 'ingredients') ? `business_id=eq.${businessId}` : undefined
                },
                async (payload) => {
                    // console.log(`📡 [${table}] ${payload.eventType}`); // noisy

                    try {
                        // INSERT / UPDATE
                        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                            const record = payload.new;
                            if (!record || !record.id) return;

                            // Conflict Check: Do we have a pending local change?
                            const localRecord = await db[table].get(record.id);

                            if (localRecord && localRecord._pendingSync) {
                                console.log(`⏳ [${table}] Local change pending for ${record.id}, skipping Realtime update`);
                                return;
                            }

                            // Safe to update
                            await db[table].put({
                                ...record,
                                _pendingSync: false,
                                _syncError: null,
                                _localUpdatedAt: new Date().toISOString() // Treat server update as fresh local baseline
                            });
                        }
                        // DELETE
                        else if (payload.eventType === 'DELETE') {
                            const oldRecord = payload.old;
                            if (!oldRecord || !oldRecord.id) return;

                            // Check if we have pending changes on this deleted item? (Unlikely edge case)
                            await db[table].delete(oldRecord.id);
                        }
                    } catch (err) {
                        console.warn(`❌ Error processing Realtime event for ${table}:`, err);
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log(`✅ Subscribed to ${table}`);
                }
            });

        subscriptions.push(channel);
    }

    return subscriptions;
};

export default {
    isOnline,
    syncTable,
    initialLoad,
    syncOrders,
    pushPendingChanges,
    subscribeToOrders,
    subscribeToOrderItems,
    subscribeToAllChanges
};
