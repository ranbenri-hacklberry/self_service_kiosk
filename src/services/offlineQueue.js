/**
 * Offline Queue Service
 * Stores actions when offline and syncs when back online
 * 
 * @module services/offlineQueue
 */

import { db } from '../db/database';
import { supabase } from '../lib/supabase';

// Queue table definition - add to database.js version 2
// For now, we'll use a simple IndexedDB pattern

const QUEUE_STORE = 'offline_queue_v2';

// MUTEX: Prevent concurrent syncQueue executions
let isSyncing = false;

/**
 * Initialize the queue store in Dexie
 * This adds the queue table to the existing database
 */
export const initializeQueue = async () => {
    // Check if queue table exists, if not we'll use localStorage as fallback
    if (!db.offline_queue_v2) {
        console.log('⚠️ offline_queue_v2 table not in Dexie, using localStorage fallback');
    }
};

/**
 * Add action to offline queue
 * @param {string} type - Action type: 'CREATE_ORDER', 'UPDATE_STATUS', 'UPDATE_CUSTOMER'
 * @param {Object} payload - Action data
 */
export const queueAction = async (type, payload) => {
    const action = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        payload,
        createdAt: new Date().toISOString(),
        status: 'pending',
        retries: 0
    };

    // Try Dexie first
    try {
        if (db.offline_queue_v2) {
            await db.offline_queue_v2.add(action);
            console.log(`📥 Queued ${type} action:`, action.id);
            return action;
        }
    } catch (e) {
        console.warn('Dexie queue failed, using localStorage:', e);
    }

    // Fallback to localStorage
    const queue = JSON.parse(localStorage.getItem(QUEUE_STORE) || '[]');
    queue.push(action);
    localStorage.setItem(QUEUE_STORE, JSON.stringify(queue));
    console.log(`📥 Queued ${type} action (localStorage):`, action.id);

    return action;
};

/**
 * Get all pending actions
 */
export const getPendingActions = async () => {
    try {
        if (db.offline_queue_v2) {
            // DIAGNOSTIC: Log all queue entries
            const allEntries = await db.offline_queue_v2.toArray();
            console.log(`📋 [Queue] Total entries: ${allEntries.length}`,
                allEntries.map(e => ({ id: e.id, type: e.type, status: e.status, orderId: e.payload?.localOrderId })));

            return await db.offline_queue_v2.where('status').equals('pending').toArray();
        }
    } catch (e) {
        console.warn('Dexie queue read failed:', e);
    }

    // Fallback
    const queue = JSON.parse(localStorage.getItem(QUEUE_STORE) || '[]');
    console.log(`📋 [Queue-localStorage] Total entries: ${queue.length}`);
    return queue.filter(a => a.status === 'pending');
};

/**
 * Mark action as completed
 */
export const markActionComplete = async (actionId) => {
    try {
        if (db.offline_queue_v2) {
            await db.offline_queue_v2.update(actionId, { status: 'completed' });
            return;
        }
    } catch (e) { /* fallback */ }

    const queue = JSON.parse(localStorage.getItem(QUEUE_STORE) || '[]');
    const idx = queue.findIndex(a => a.id === actionId);
    if (idx >= 0) {
        queue[idx].status = 'completed';
        localStorage.setItem(QUEUE_STORE, JSON.stringify(queue));
    }
};

/**
 * Mark action as failed
 */
export const markActionFailed = async (actionId, error) => {
    try {
        if (db.offline_queue_v2) {
            const action = await db.offline_queue_v2.get(actionId);
            await db.offline_queue_v2.update(actionId, {
                status: 'failed',
                error: error?.message || 'Unknown error',
                retries: (action?.retries || 0) + 1
            });
            return;
        }
    } catch (e) { /* fallback */ }

    const queue = JSON.parse(localStorage.getItem(QUEUE_STORE) || '[]');
    const idx = queue.findIndex(a => a.id === actionId);
    if (idx >= 0) {
        queue[idx].status = 'failed';
        queue[idx].error = error?.message;
        queue[idx].retries = (queue[idx].retries || 0) + 1;
        localStorage.setItem(QUEUE_STORE, JSON.stringify(queue));
    }
};

/**
 * Handle sync error with exponential backoff
 */
const handleSyncError = async (action, error) => {
    const maxRetries = 5;
    const retryDelay = Math.pow(2, action.retries || 0) * 1000; // 1s, 2s, 4s, 8s...

    console.warn(`⚠️ Sync failed for ${action.type} (Attempt ${action.retries || 0}):`, error.message);

    if ((action.retries || 0) < maxRetries) {
        // Schedule retry
        await db.offline_queue_v2.update(action.id, {
            status: 'pending',
            retries: (action.retries || 0) + 1,
            // We don't have a 'nextRetry' field in schema yet so we just rely on order
            // or we could add it, but for now simple retry count is enough
            error: error.message
        });
        // Optional: delay next process loop slightly? 
        // For now queue processor just picks it up again next loop.
    } else {
        // Mark as permanently failed
        await db.offline_queue_v2.update(action.id, {
            status: 'failed',
            error: error.message
        });

        // Update local record with error
        if (action.table && action.recordId) {
            try {
                await db[action.table].update(action.recordId, {
                    _syncError: error.message,
                    _pendingSync: false // Stop trying
                });
            } catch (e) {
                console.warn('Failed to update local record with error:', e);
            }
        }
        console.error(`❌ Action ${action.id} permanently failed after ${maxRetries} retries`);
    }
};

/**
 * Process generic CRUD action (CREATE, UPDATE, DELETE)
 * Implements "Last-Write-Wins" conflict resolution
 */
const processGenericAction = async (action) => {
    const { type, table, recordId, payload } = action;

    try {
        switch (type) {
            case 'CREATE': {
                // For create, we just trying to insert.
                // If ID exists (UUID collision or re-sync), it might fail.
                const { error } = await supabase.from(table).insert(payload);
                if (error) {
                    // Start: handling duplicate key error (PGRST116 or 23505)
                    if (error.code === '23505') {
                        console.log('ℹ️ Record already exists, treating as success/skip');
                    } else {
                        throw error;
                    }
                }

                // Mark local record as synced
                await db[table].update(recordId, {
                    _pendingSync: false,
                    _syncError: null
                });
                return { success: true };
            }

            case 'UPDATE': {
                // Last-Write-Wins: Check server timestamp
                const { data: serverRecord, error: fetchError } = await supabase
                    .from(table)
                    .select('updated_at')
                    .eq('id', recordId)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

                let shouldPush = true;

                if (serverRecord) {
                    const localRecord = await db[table].get(recordId);
                    // If server is newer than our local change timestamp, we MIGHT skip
                    // strict LWW: Server updated_at vs Local _localUpdatedAt
                    if (localRecord && localRecord._localUpdatedAt &&
                        new Date(localRecord._localUpdatedAt) <= new Date(serverRecord.updated_at)) {
                        console.log(`⏭️ Server has newer data (${serverRecord.updated_at}), skipping push.`);
                        shouldPush = false;
                    }
                }

                if (shouldPush) {
                    // Update server
                    const updatePayload = {
                        ...payload,
                        updated_at: new Date().toISOString() // refresh timestamp
                    };

                    const { error } = await supabase
                        .from(table)
                        .update(updatePayload)
                        .eq('id', recordId);

                    if (error) throw error;
                    console.log(`✅ Updated server record ${recordId}`);
                }

                // Mark local as synced
                await db[table].update(recordId, {
                    _pendingSync: false,
                    _syncError: null
                });

                return { success: true };
            }

            case 'DELETE': {
                const { error } = await supabase.from(table).delete().eq('id', recordId);
                // Ignore "not found" (PGRST116) as it's already deleted
                if (error && error.code !== 'PGRST116') throw error;

                return { success: true };
            }

            default:
                return { success: false, error: 'Unknown generic type' };
        }
    } catch (error) {
        await handleSyncError(action, error);
        throw error; // Re-throw to count as failed in main loop
    }
};

/**
 * Process a single action
 */
const processAction = async (action) => {
    console.log('🔄 Processing offline action:', action.type, action.payload);

    // Validate ID format before sending to Supabase to prevent 400 errors
    const isUUID = (id) => typeof id === 'string' && id.length > 20 && id.includes('-');
    const targetId = action.payload?.orderId || action.payload?.itemId;

    // Allow local temp IDs ('L...') because logic handles them via serverOrderId mapping 
    // BUT block pure numeric/short IDs like "885" or "1692" which cause crashes
    if (targetId && !isUUID(targetId) && !String(targetId).startsWith('L')) {
        console.warn(`🛑 Skipping action for invalid non-UUID ID: ${targetId}. Marking as done.`);
        return { skipped: true, reason: 'invalid_id_format' };
    }

    // NEW: Handle generic CRUD actions
    if (['CREATE', 'UPDATE', 'DELETE'].includes(action.type)) {
        return processGenericAction(action);
    }

    switch (action.type) {
        case 'CREATE_ORDER': {
            // Remove localOrderId and serverOrderId from payload - for internal tracking only
            const { localOrderId, serverOrderId, ...rpcPayload } = action.payload;

            // If already has serverOrderId - it was already synced, skip
            if (serverOrderId) {
                console.log('⏭️ Order already has server ID, skipping:', serverOrderId);
                return { skipped: true, reason: 'has_server_id' };
            }

            // Check if local order still exists
            let existingOrder = null;
            if (localOrderId) {
                existingOrder = await db.orders.get(localOrderId);
                if (!existingOrder) {
                    console.log('⏭️ Local order not found – probably already synced:', localOrderId);
                    return { skipped: true, reason: 'not_found' };
                }

                // Check if already has serverOrderId (was synced but action still pending)
                if (existingOrder.serverOrderId) {
                    console.log('⏭️ Order already synced (has serverOrderId):', existingOrder.serverOrderId);
                    return { skipped: true, reason: 'already_synced' };
                }

                // Check if already being processed
                if (existingOrder._processing) {
                    console.log('⏭️ Order already being processed, skipping:', localOrderId);
                    return { skipped: true, reason: 'already_processing' };
                }

                // Set processing flag
                await db.orders.update(localOrderId, { _processing: true });
            }

            // 🔄 CRITICAL: Use LATEST customer data from Dexie, not from original payload
            // This ensures customer name updates made after order creation are synced
            const finalPayload = { ...rpcPayload };
            if (existingOrder) {
                if (existingOrder.customer_name && existingOrder.customer_name !== rpcPayload.p_customer_name) {
                    console.log(`📝 CREATE_ORDER: Using updated customer name from Dexie: "${existingOrder.customer_name}"`);
                    finalPayload.p_customer_name = existingOrder.customer_name;
                }
                if (existingOrder.customer_phone && existingOrder.customer_phone !== rpcPayload.p_customer_phone) {
                    finalPayload.p_customer_phone = existingOrder.customer_phone;
                }
                if (existingOrder.customer_id && existingOrder.customer_id !== rpcPayload.p_customer_id) {
                    finalPayload.p_customer_id = existingOrder.customer_id;
                }
            }

            console.log('📤 Syncing order to Supabase...', { localOrderId, customerName: finalPayload.p_customer_name });
            const { data, error } = await supabase.rpc('submit_order_v2', finalPayload);
            if (error) throw error;

            // Mark local order with serverOrderId (don't delete - for tracking)
            // 🔄 SUCCESS: Replace local order with server order in Dexie
            if (data?.order_id && localOrderId) {
                try {
                    // 1. Get current local state
                    const localOrder = await db.orders.get(localOrderId);
                    const localItems = await db.order_items.where('order_id').equals(localOrderId).toArray();

                    console.log(`♻️ Replacing local ${localOrderId} with server ${data.order_id} in Dexie`);

                    // 2. Create the new server-version record in Dexie
                    await db.orders.put({
                        ...localOrder,
                        id: data.order_id,
                        order_number: data.order_number || localOrder.order_number,
                        serverOrderId: data.order_id,
                        _processing: false,
                        pending_sync: false,
                        is_offline: false,
                        updated_at: new Date().toISOString()
                    });

                    // 3. Move items to the new ID
                    for (const item of localItems) {
                        await db.order_items.put({
                            ...item,
                            order_id: data.order_id
                        });
                        // Delete old item record
                        await db.order_items.delete(item.id);
                    }

                    // 4. Update any other pending actions in the queue for this local ID
                    // Note: Dexie doesn't support querying nested fields, so we filter manually
                    try {
                        const allPendingActions = await db.offline_queue_v2
                            .where('status')
                            .equals('pending')
                            .toArray();

                        const actionsToUpdate = allPendingActions.filter(a =>
                            a.payload?.orderId === localOrderId ||
                            a.payload?.localOrderId === localOrderId
                        );

                        console.log(`🔄 Found ${actionsToUpdate.length} pending actions to update with new order ID`);

                        for (const actionRecord of actionsToUpdate) {
                            const updatedPayload = { ...actionRecord.payload };
                            if (updatedPayload.orderId === localOrderId) {
                                updatedPayload.orderId = data.order_id;
                            }
                            if (updatedPayload.localOrderId === localOrderId) {
                                updatedPayload.localOrderId = data.order_id;
                            }
                            await db.offline_queue_v2.update(actionRecord.id, {
                                payload: updatedPayload
                            });
                            console.log(`✏️ Updated action ${actionRecord.type} with new orderId: ${data.order_id}`);
                        }
                    } catch (queueErr) {
                        console.warn('Failed to update pending queue actions:', queueErr);
                    }

                    // 5. DELETE the original local order record
                    await db.orders.delete(localOrderId);

                    console.log(`✅ Order ${localOrderId} is now ${data.order_id}. Local record deleted.`);

                    // 6. SYNC STATUS: If local status was non-default, update Supabase immediately
                    const currentStatus = localOrder?.order_status || 'in_progress';
                    if (currentStatus !== 'in_progress') {
                        console.log('📤 Syncing local status change to Supabase:', currentStatus);

                        const updateFields = {
                            order_status: currentStatus,
                            updated_at: new Date().toISOString()
                        };
                        if (currentStatus === 'ready' && localOrder.ready_at) {
                            updateFields.ready_at = localOrder.ready_at;
                        }

                        await supabase.from('orders').update(updateFields).eq('id', data.order_id);

                        const itemStatus = currentStatus === 'completed' ? 'completed' :
                            currentStatus === 'ready' ? 'ready' : 'in_progress';

                        await supabase.from('order_items').update({
                            item_status: itemStatus,
                            updated_at: new Date().toISOString()
                        }).eq('order_id', data.order_id);

                        console.log('✅ Final status synced.');
                    }
                } catch (e) {
                    console.error('Failed to update local order with serverOrderId:', e);
                }
            }
            return data;
        }

        case 'UPDATE_ITEM_STATUS': {
            let { orderId, itemId, newStatus } = action.payload;

            // Map localOrderId -> serverOrderId if needed
            if (orderId) {
                try {
                    const localOrder = await db.orders.get(orderId);
                    if (localOrder?.serverOrderId) {
                        orderId = localOrder.serverOrderId;
                    }
                } catch (e) { /* ignore */ }
            }

            const { error } = await supabase
                .from('order_items')
                .update({ item_status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', itemId);
            if (error) throw error;
            return { success: true };
        }

        case 'UPDATE_ORDER_STATUS': {
            let { orderId, newStatus, localOrderId, isLocalOrder } = action.payload;

            console.log(`📤 Processing UPDATE_ORDER_STATUS: orderId=${orderId}, newStatus=${newStatus}, isLocalOrder=${isLocalOrder}`);

            // For local orders, we need to find the server order ID
            if (isLocalOrder || (localOrderId && (String(localOrderId).startsWith('L') || String(orderId).startsWith('L')))) {
                const localId = localOrderId || orderId;
                console.log(`🔍 Looking up server order ID for local order: ${localId}`);

                try {
                    // Look in Dexie for the order with this local ID or serverOrderId mapping
                    const localOrder = await db.orders.get(localId);

                    if (localOrder?.serverOrderId) {
                        console.log(`✅ Found serverOrderId: ${localOrder.serverOrderId}`);
                        orderId = localOrder.serverOrderId;
                    } else {
                        // Order hasn't been synced yet - skip this status update
                        // The CREATE_ORDER sync will use the current Dexie status
                        console.log(`⏳ Order ${localId} hasn't synced yet - status update stored in Dexie will be used during CREATE_ORDER`);
                        return { success: true, skipped: true, reason: 'Order not yet synced' };
                    }
                } catch (e) {
                    console.warn('Local order lookup failed:', e);
                    return { success: true, skipped: true, reason: 'Lookup failed' };
                }
            } else {
                // Regular order - try to get serverOrderId if available
                try {
                    const localOrder = await db.orders.get(orderId);
                    if (localOrder?.serverOrderId) {
                        console.log(`🔗 Mapping local order ${orderId} to server order ${localOrder.serverOrderId}`);
                        orderId = localOrder.serverOrderId;
                    }
                } catch (e) { /* ignore */ }
            }

            // Now orderId should be a valid UUID
            if (!orderId || String(orderId).startsWith('L') || String(orderId).length < 20) {
                console.warn(`⚠️ Cannot update status - invalid orderId: ${orderId}`);
                return { success: true, skipped: true, reason: 'Invalid order ID' };
            }

            // Update order status in Supabase
            const { error: orderError } = await supabase
                .from('orders')
                .update({ order_status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', orderId);
            if (orderError) throw orderError;

            // Also update all order items to match
            const itemStatus = newStatus === 'completed' ? 'completed' :
                newStatus === 'ready' ? 'ready' : 'in_progress';

            const { error: itemsError } = await supabase
                .from('order_items')
                .update({ item_status: itemStatus, updated_at: new Date().toISOString() })
                .eq('order_id', orderId);

            if (itemsError) console.warn('Failed to update order_items:', itemsError);

            // 💾 Sync complete: Update Dexie immediately so fetchOrders sees the new state
            try {
                await db.orders.update(orderId, {
                    order_status: newStatus,
                    pending_sync: false
                });

                await db.order_items.where('order_id').equals(orderId).modify({
                    item_status: itemStatus
                });

                console.log(`💾 Post-Sync: Updated Dexie for ${orderId} to ${newStatus}`);
            } catch (e) {
                console.warn('Post-sync Dexie update failed:', e);
            }

            return { success: true };
        }

        case 'UPDATE_CUSTOMER': {
            let { orderId, customerId, customerName, customerPhone } = action.payload;

            // Map localOrderId -> serverOrderId if needed
            try {
                const localOrder = await db.orders.get(orderId);
                if (localOrder?.serverOrderId) {
                    console.log(`📝 UPDATE_CUSTOMER: Mapping ${orderId} -> ${localOrder.serverOrderId}`);
                    orderId = localOrder.serverOrderId;
                } else if (localOrder && !localOrder.serverOrderId) {
                    // Order hasn't been synced yet - skip and let it be included in CREATE_ORDER
                    console.log(`⏳ UPDATE_CUSTOMER: Order ${orderId} not synced yet, skipping...`);
                    return { success: true, skipped: true, reason: 'order_not_synced' };
                }
            } catch (e) {
                console.warn('Failed to lookup order for customer update:', e);
            }

            const { error } = await supabase.rpc('update_order_customer', {
                p_order_id: orderId,
                p_customer_id: customerId,
                p_customer_name: customerName,
                p_customer_phone: customerPhone
            });
            if (error) throw error;
            return { success: true };
        }

        case 'CONFIRM_PAYMENT': {
            let { orderId, paymentMethod } = action.payload;

            // Map localOrderId -> serverOrderId if needed
            try {
                const localOrder = await db.orders.get(orderId);
                if (localOrder?.serverOrderId) {
                    orderId = localOrder.serverOrderId;
                }
            } catch (e) { /* ignore */ }

            const { error } = await supabase.rpc('confirm_order_payment', {
                p_order_id: orderId,
                p_payment_method: paymentMethod
            });
            if (error) throw error;
            return { success: true };
        }

        default:
            console.warn('Unknown action type:', action.type);
            return { success: false };
    }
};

/**
 * Sync all pending actions to Supabase
 * Call this when device comes back online
 */
export const syncQueue = async () => {
    // MUTEX: Prevent concurrent sync (multiple callers like AuthContext + KDS)
    if (isSyncing) {
        console.log('⏳ Sync already in progress, skipping...');
        return { synced: 0, failed: 0, skipped: true };
    }
    isSyncing = true;

    try {
        if (!navigator.onLine) {
            console.log('📴 Still offline, skipping sync');
            return { synced: 0, failed: 0 };
        }

        const pending = await getPendingActions();
        if (pending.length === 0) {
            console.log('✅ No pending actions to sync');
            return { synced: 0, failed: 0 };
        }

        console.log(`🔄 Syncing ${pending.length} pending actions...`);
        let synced = 0;
        let failed = 0;

        for (const action of pending) {
            try {
                await processAction(action);
                await markActionComplete(action.id);
                synced++;
                console.log(`✅ Synced ${action.type}:`, action.id);
            } catch (error) {
                console.error(`❌ Failed to sync ${action.type}:`, error);
                await markActionFailed(action.id, error);
                failed++;
            }
        }

        // Clean up completed actions to prevent queue from growing
        if (synced > 0) {
            await clearCompleted();
            console.log('🧹 Cleaned up completed actions');
        }

        console.log(`📊 Sync complete: ${synced} synced, ${failed} failed`);
        return { synced, failed };
    } finally {
        isSyncing = false;
    }
};

/**
 * Clear completed actions (cleanup)
 */
export const clearCompleted = async () => {
    try {
        if (db.offline_queue_v2) {
            await db.offline_queue_v2.where('status').equals('completed').delete();
            return;
        }
    } catch (e) { /* fallback */ }

    const queue = JSON.parse(localStorage.getItem(QUEUE_STORE) || '[]');
    const filtered = queue.filter(a => a.status !== 'completed');
    localStorage.setItem(QUEUE_STORE, JSON.stringify(filtered));
};

/**
 * Get queue statistics
 */
export const getQueueStats = async () => {
    let pending = 0, failed = 0, completed = 0;

    try {
        if (db.offline_queue_v2) {
            pending = await db.offline_queue_v2.where('status').equals('pending').count();
            failed = await db.offline_queue_v2.where('status').equals('failed').count();
            completed = await db.offline_queue_v2.where('status').equals('completed').count();
            return { pending, failed, completed };
        }
    } catch (e) { /* fallback */ }

    const queue = JSON.parse(localStorage.getItem(QUEUE_STORE) || '[]');
    pending = queue.filter(a => a.status === 'pending').length;
    failed = queue.filter(a => a.status === 'failed').length;
    completed = queue.filter(a => a.status === 'completed').length;

    return { pending, failed, completed };
};

// NOTE: Auto-sync on 'online' event is handled in AuthContext.jsx
// Do NOT add another listener here to avoid duplicate syncs!

export default {
    queueAction,
    getPendingActions,
    syncQueue,
    getQueueStats,
    clearCompleted
};
