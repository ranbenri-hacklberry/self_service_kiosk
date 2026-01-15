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
        // orders and order_items handled via specialized syncOrders RPC
        // { local: 'orders', ... } - REMOVED from generic loop
        // { local: 'order_items', ... } - REMOVED from generic loop
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

            if (error) {
                console.error(`❌ RPC error for customers:`, error.message);
                return { success: false, error: error.message };
            }
            if (data) {
                await db[localTable].bulkPut(data);

                // AGGRESSIVE PRUNING: Remove local customers missing from cloud
                const cloudIds = new Set(data.map(c => c.id));
                const allLocal = await db[localTable].toArray();
                const idsToDelete = allLocal
                    .filter(item => (item.business_id === businessId || !item.business_id) && !cloudIds.has(item.id))
                    .map(item => item.id);

                if (idsToDelete.length > 0) {
                    console.warn(`🧹 Pruning ${idsToDelete.length} stale customers from local DB...`);
                    await db[localTable].bulkDelete(idsToDelete);
                }

                console.log(`✅ Synced ${data.length} customers via RPC`);
                return { success: true, count: data.length };
            }
        }

        // Special handling for loyalty_cards - use RPC
        if (remoteTable === 'loyalty_cards' && businessId) {
            console.log(`🔄 Using RPC for loyalty_cards sync...`);
            const { data, error } = await supabase.rpc('get_loyalty_cards_for_sync', {
                p_business_id: businessId
            });

            if (error) {
                console.error(`❌ RPC error for loyalty_cards:`, error.message);
                return { success: false, error: error.message };
            }
            if (data) {
                await db[localTable].bulkPut(data);

                // AGGRESSIVE PRUNING: Remove local cards missing from cloud
                const cloudIds = new Set(data.map(c => c.id));
                const allLocal = await db[localTable].toArray();
                const idsToDelete = allLocal
                    .filter(item => (item.business_id === businessId || !item.business_id) && !cloudIds.has(item.id))
                    .map(item => item.id);

                if (idsToDelete.length > 0) {
                    console.warn(`🧹 Pruning ${idsToDelete.length} stale loyalty_cards from local DB...`);
                    await db[localTable].bulkDelete(idsToDelete);
                }

                console.log(`✅ Synced ${data.length} loyalty_cards via RPC`);
                return { success: true, count: data.length };
            }
            return { success: true, count: 0 };
        }

        // Special handling for loyalty_transactions - use RPC
        if (remoteTable === 'loyalty_transactions' && businessId) {
            console.log(`🔄 Using RPC for loyalty_transactions sync...`);
            const { data, error } = await supabase.rpc('get_loyalty_transactions_for_sync', {
                p_business_id: businessId
            });

            if (error) {
                console.error(`❌ RPC error for loyalty_transactions:`, error.message);
                return { success: false, error: error.message };
            }
            if (data) {
                await db[localTable].bulkPut(data);

                // AGGRESSIVE PRUNING: Remove local transactions missing from cloud
                const cloudIds = new Set(data.map(c => c.id));
                const allLocal = await db[localTable].toArray();
                const idsToDelete = allLocal
                    .filter(item => (item.business_id === businessId || !item.business_id) && !cloudIds.has(item.id))
                    .map(item => item.id);

                if (idsToDelete.length > 0) {
                    console.warn(`🧹 Pruning ${idsToDelete.length} stale loyalty_transactions from local DB...`);
                    await db[localTable].bulkDelete(idsToDelete);
                }

                console.log(`✅ Synced ${data.length} loyalty_transactions via RPC`);
                return { success: true, count: data.length };
            }
            return { success: true, count: 0 };
        }

        // Special handling for order_items - sync only items from this business's orders
        if (remoteTable === 'order_items' && businessId) {
            console.log(`🔄 Syncing order_items via orders join...`);
            // First get the order IDs for this business
            const { data: orderIds, error: orderError } = await supabase
                .from('orders')
                .select('id')
                .eq('business_id', businessId);

            if (orderError) {
                console.error(`❌ Error getting orders for order_items:`, orderError.message);
                return { success: false, error: orderError.message };
            }

            if (!orderIds || orderIds.length === 0) {
                console.log(`📭 No orders found, skipping order_items`);
                return { success: true, count: 0 };
            }

            const ids = orderIds.map(o => o.id);
            // Fetch order_items for these orders (in batches if many)
            const { data, error } = await supabase
                .from('order_items')
                .select('*')
                .in('order_id', ids.slice(0, 100)) // Limit to first 100 orders for performance
                .limit(SYNC_CONFIG.batchSize);

            if (error) {
                console.error(`❌ Error syncing order_items:`, error.message);
                return { success: false, error: error.message };
            }

            if (data && data.length > 0) {
                await db[localTable].bulkPut(data);
                console.log(`✅ Synced ${data.length} order_items`);
            }
            return { success: true, count: data?.length || 0 };
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

    // Use date from 30 days ago to capture enough historical data and ensure cleanup of old demo data
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 30); // 30 days of history
    const fromDateISO = fromDate.toISOString();
    const toDateISO = new Date().toISOString();

    console.log('📅 [syncOrders] Filtering and Pruning from:', fromDateISO, 'to:', toDateISO);

    try {
        // Use get_orders_history RPC to get ALL orders (not just active)
        const { data: ordersData, error: ordersError } = await supabase.rpc('get_orders_history', {
            p_from_date: fromDateISO,
            p_to_date: toDateISO,
            p_business_id: businessId
        });

        if (ordersError) {
            console.error('❌ Orders sync error:', ordersError);
            return { success: false, error: ordersError };
        }

        const orders = Array.isArray(ordersData) ? ordersData : (ordersData || []);
        const cloudOrderIds = new Set(orders.map(o => o.id));
        let prunedCount = 0;

        console.log(`📦 [syncOrders] Cloud returned ${orders.length} orders. Starting sync & pruning...`);

        await db.transaction('rw', [db.orders, db.order_items], async () => {
            // 1. Update/Insert orders from cloud
            if (orders.length > 0) {
                for (const order of orders) {
                    const existing = await db.orders.get(order.id);
                    if (existing?.pending_sync) {
                        const serverTime = new Date(order.updated_at || 0).getTime();
                        const localTime = new Date(existing.updated_at || 0).getTime();
                        if (serverTime <= localTime) continue;
                    }

                    const orderItems = order.order_items || order.items_detail || [];
                    await db.orders.put({
                        id: order.id,
                        order_number: order.order_number,
                        order_status: order.order_status,
                        is_paid: order.is_paid,
                        customer_id: order.customer_id,
                        customer_name: order.customer_name,
                        customer_phone: order.customer_phone,
                        total_amount: order.total_amount,
                        business_id: order.business_id || businessId,
                        order_type: order.order_type || 'dine_in',
                        delivery_address: order.delivery_address,
                        delivery_fee: order.delivery_fee,
                        delivery_notes: order.delivery_notes,
                        created_at: order.created_at,
                        updated_at: order.updated_at || new Date().toISOString(),
                        pending_sync: false,
                        payment_screenshot_url: order.payment_screenshot_url,
                        payment_method: order.payment_method,
                        payment_verified: order.payment_verified,
                        seen_at: order.seen_at,
                        driver_id: order.driver_id,
                        driver_name: order.driver_name,
                        driver_phone: order.driver_phone,
                        courier_name: order.courier_name
                    });

                    if (orderItems.length > 0) {
                        for (const item of orderItems) {
                            await db.order_items.put({
                                id: item.id,
                                order_id: order.id,
                                menu_item_id: item.menu_item_id || item.menu_items?.id,
                                quantity: item.quantity,
                                price: item.price || item.menu_items?.price,
                                mods: item.mods,
                                notes: item.notes,
                                item_status: item.item_status,
                                course_stage: item.course_stage || 1,
                                created_at: item.created_at || order.created_at
                            });
                        }
                    }
                }
            }

            // 2. AGGRESSIVE PRUNING: Find local records in this window that are NOT in the cloud response
            // We fetch ALL local orders to ensure legacy/demo data (possibly with wrong business_id) is cleared.
            const allLocalOrders = await db.orders.toArray();
            const ordersToDelete = allLocalOrders.filter(o => {
                const orderDate = new Date(o.created_at);
                // Only prune within our 30-day sync window
                if (orderDate < fromDate) return false;
                // If it's a local order in our window but NOT in the cloud response -> Delete
                return !cloudOrderIds.has(o.id);
            });

            if (ordersToDelete.length > 0) {
                prunedCount = ordersToDelete.length;
                const idsToDelete = ordersToDelete.map(o => o.id);
                console.warn(`🧹 [syncOrders] PRUNING: Removing ${idsToDelete.length} deleted/demo orders...`);
                await db.orders.bulkDelete(idsToDelete);
                // Clean up orphaned items
                await db.order_items.where('order_id').anyOf(idsToDelete).delete();
            }
        });

        return { success: true, ordersCount: orders.length, prunedCount };

    } catch (err) {
        console.error('❌ syncOrders exception:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Sync loyalty data (cards and transactions)
 * @param {string} businessId
 */
export const syncLoyalty = async (businessId) => {
    if (!isOnline()) return { success: false, reason: 'offline' };

    try {
        console.log(`🔄 [syncLoyalty] Syncing loyalty for ${businessId}...`);

        // 1. Sync Cards
        const cardRes = await syncTable('loyalty_cards', 'loyalty_cards', null, businessId);

        // 2. Sync Transactions
        const txRes = await syncTable('loyalty_transactions', 'loyalty_transactions', null, businessId);

        return {
            success: true,
            cards: cardRes.count || 0,
            transactions: txRes.count || 0
        };
    } catch (err) {
        console.error('❌ syncLoyalty failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Initial load - hydrate all tables from Supabase
 * Uses standard sync for config tables and specialized RPC sync for orders
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
    const totalTables = SYNC_CONFIG.tables.length + 1; // +1 for Orders

    // 1. Sync Standard Tables
    for (let i = 0; i < SYNC_CONFIG.tables.length; i++) {
        const table = SYNC_CONFIG.tables[i];
        const result = await syncTable(table.local, table.remote, table.filter, businessId);
        results[table.local] = result;

        const progress = Math.round(((i + 1) / totalTables) * 100);
        console.log(`📊 Sync progress: ${progress}% - ${table.local}`);
        if (onProgress) onProgress(table.local, result.count || 0, progress);
    }

    // 2. Sync Orders (Specialized RPC for history + items)
    console.log('📦 Syncing Orders via RPC...');
    const ordersResult = await syncOrders(businessId);
    results['orders'] = ordersResult;

    if (onProgress) onProgress('orders', ordersResult.ordersCount || 0, 100);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Initial load complete in ${duration}s`, results);

    return { success: true, results, duration };
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

                            if (localRecord && localRecord.pending_sync) {
                                console.log(`⏳ [${table}] Local change pending for ${record.id}, skipping Realtime update`);
                                return;
                            }

                            // Safe to update
                            await db[table].put({
                                ...record,
                                pending_sync: false,
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

/**
 * Sync Doctor - Finds discrepancies between Dexie and Supabase for critical orders
 * @param {string} businessId
 */
export const getSyncDiffs = async (businessId) => {
    if (!isOnline()) return { success: false, reason: 'offline' };

    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // 1. Get local orders
        const localOrders = await db.orders
            .where('business_id').equals(businessId)
            .filter(o => o.created_at >= todayISO)
            .toArray();

        // 2. Get remote orders
        const { data: remoteOrders, error } = await supabase
            .from('orders')
            .select('*')
            .eq('business_id', businessId)
            .gte('created_at', todayISO);

        if (error) throw error;

        // 3. Find mismatches
        const diffs = localOrders.map(local => {
            const remote = remoteOrders.find(r => r.id === local.id);
            if (!remote) return null; // Let standard sync handle missing remotes for now

            const hasStatusDiff = remote.order_status !== local.order_status;
            const hasSeenDiff = remote.seen_at !== local.seen_at;

            if (hasStatusDiff || hasSeenDiff) {
                // NEW: Cooldown - skip if updated in last 60 seconds to allow real-time settling
                const recentlyUpdated = new Date(local.updated_at) > new Date(Date.now() - 60000);
                if (recentlyUpdated) return null;

                // Determine direction: 
                // IF local has pending_sync -> PUSH (local is newer/truth)
                // ELSE -> PULL (remote is truth, local is stale)
                const direction = local.pending_sync ? 'PUSH' : 'PULL';

                return {
                    id: local.id,
                    orderNumber: local.order_number,
                    type: 'mismatch',
                    direction,
                    local: { status: local.order_status, seen_at: local.seen_at },
                    remote: { status: remote.order_status, seen_at: remote.seen_at }
                };
            }
            return null;
        }).filter(Boolean);

        return { success: true, diffs };
    } catch (err) {
        console.error('❌ Sync Doctor failed:', err);
        return { success: false, error: err.message };
    }
};

/**
 * Reconcile a specific order based on Sync Doctor's findings
 */
export const healOrder = async (diff, businessId) => {
    try {
        if (diff.direction === 'PUSH') {
            console.log(`📤 [SyncDoctor] Pushing local truth for ${diff.orderNumber}`);
            const local = await db.orders.get(diff.id);
            if (!local) return false;

            // Use Safe RPC for pushing
            const { error: rpcError } = await supabase.rpc('update_order_status_v3', {
                p_order_id: diff.id,
                p_new_status: local.order_status,
                p_business_id: businessId
            });

            if (rpcError) throw rpcError;
            await db.orders.update(diff.id, { pending_sync: false });
            return true;
        } else {
            console.log(`📥 [SyncDoctor] Pulling remote truth for ${diff.orderNumber}`);
            // Direction is PULL - update Dexie with remote data
            await db.orders.update(diff.id, {
                order_status: diff.remote.status,
                seen_at: diff.remote.seen_at,
                updated_at: new Date().toISOString()
            });
            return true;
        }
    } catch (err) {
        console.error('❌ healOrder failed:', err);
        return false;
    }
};

export default {
    isOnline,
    syncTable,
    initialLoad,
    syncOrders,
    syncLoyalty,
    pushPendingChanges,
    subscribeToOrders,
    subscribeToOrderItems,
    subscribeToAllChanges,
    getSyncDiffs,
    healOrder
};
