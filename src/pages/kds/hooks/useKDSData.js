/**
 * ⚠️ IMPORTANT: RLS (Row Level Security) is ALWAYS enabled on Supabase!
 * This is a multi-tenant application. If orders are not loading:
 * 1. FIRST check RLS policies in Supabase Dashboard for 'orders' and 'order_items' tables
 * 2. Verify the user's business_id matches the data
 * 3. Check if the auth token is being sent correctly
 * 4. Use Supabase Dashboard → SQL Editor to test queries directly
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { sendSms } from '../../../services/smsService';
import { groupOrderItems, sortItems } from '../../../utils/kdsUtils';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../../db/database';

// Check if device is online
const checkOnline = () => navigator.onLine;

export const useKDSData = () => {
    const { currentUser } = useAuth();
    const [currentOrders, setCurrentOrders] = useState([]);
    const [completedOrders, setCompletedOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isOffline, setIsOffline] = useState(!navigator.onLine);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [lastAction, setLastAction] = useState(null);
    const [smsToast, setSmsToast] = useState(null);
    const [errorModal, setErrorModal] = useState(null);
    const [isSendingSms, setIsSendingSms] = useState(false);

    // OPTIMIZATION: Cache option map to avoid fetching on every poll
    const optionMapRef = useRef(new Map());

    // ANTI-JUMP: Skip auto-fetch for 3 seconds after manual status update
    // This prevents polling/realtime from overwriting optimistic state before animation completes
    const skipFetchUntilRef = useRef(0);

    // ANTI-FLICKER: Track recent local updates to override stale server data
    const recentLocalUpdatesRef = useRef(new Map());

    // 🟢 PRODUCTION LOGGING HELPERS
    const DEBUG = true; // Enabled for diagnostic purposes
    const log = (...args) => console.log(...args);
    const warn = (...args) => console.warn(...args);

    // 🛠️ SMART ID HELPER: Ensures ID is the correct type for Dexie (Numeric for Supabase, String for Local)
    const getSmartId = (id) => {
        if (!id) return id;
        if (typeof id === 'number') return id;
        const idStr = String(id).replace(/-stage-\d+/, '').replace('-ready', '');

        // CRITICAL FIX: Do NOT parse UUIDs as integers even if they start with a digit!
        if (idStr.length > 20 && idStr.includes('-')) return idStr;

        if (idStr.startsWith('L')) return idStr; // Local ID
        const parsed = parseInt(idStr, 10);
        return isNaN(parsed) ? idStr : parsed;
    };

    // 🛠️ GLOBAL AUTO-HEAL: Run once on mount to fix ALL Dexie inconsistencies
    useEffect(() => {
        const healDexieData = async () => {
            try {
                const { db } = await import('../../../db/database');
                // Removed duplicate db declaration

                // OPTIMIZATION: Only scan ACTIVE orders, not the whole history!
                // Scanning thousands of completed orders freezes weak Android tablets.
                // Note: 'pending' included for toggle support - filtering happens in UI
                const activeOrders = await db.orders
                    .where('order_status')
                    .anyOf('new', 'in_progress', 'pending')
                    .toArray();

                const allItems = await db.order_items.toArray(); // Optimized later if needed, but usually manageable

                let healedCount = 0;

                for (const order of activeOrders) {
                    const orderItems = allItems.filter(i => String(i.order_id) === String(order.id));
                    // ... remainder of logic ...

                    if (orderItems.length === 0) continue;

                    let correctStatus = order.order_status;

                    // Logic 1: If ANY item is active, order MUST be in an active status
                    const hasActive = orderItems.some(i => ['in_progress', 'new', 'pending', 'held'].includes(i.item_status));
                    if (hasActive && !['in_progress', 'pending', 'new'].includes(order.order_status)) {
                        correctStatus = 'in_progress';
                    }

                    // Logic 2: If ALL items are ready/completed, order SHOULD be ready (unless already completed)
                    const allDone = orderItems.every(i => ['ready', 'completed', 'cancelled'].includes(i.item_status));
                    if (allDone && order.order_status === 'in_progress') {
                        correctStatus = 'ready';
                    }

                    // Logic 3: If ALL items are completed, order SHOULD be completed
                    const allCompleted = orderItems.every(i => ['completed', 'cancelled'].includes(i.item_status));
                    if (allCompleted && order.order_status !== 'completed') {
                        correctStatus = 'completed';
                    }

                    // Apply Fix
                    if (correctStatus !== order.order_status) {
                        console.log(`🏥 Healing Order ${order.order_number || order.id}: ${order.order_status} -> ${correctStatus}`);
                        await db.orders.update(order.id, {
                            order_status: correctStatus,
                            pending_sync: true, // Mark for sync so server gets the fix
                            updated_at: new Date().toISOString()
                        });
                        healedCount++;
                    }
                }

                if (healedCount > 0) console.log(`✅ Auto-Healed ${healedCount} inconsistent orders in Dexie`);

            } catch (err) {
                console.error('Auto-heal failed:', err);
            }
        };

        healDexieData();
    }, []);

    const fetchOrders = useCallback(async (signal) => {
        try {
            setIsLoading(true);
            const businessId = currentUser?.business_id;
            const isOnline = navigator.onLine;

            // Track if we're working offline
            setIsOffline(!isOnline);

            log(`🔍 [useKDSData] Fetching orders... ${isOnline ? '🌐 Online' : '📴 Offline'}`, {
                businessId,
                userId: currentUser?.id
            });

            // Build option map (from Dexie first, for speed and offline support)
            // CACHING: Only load options if cache is empty
            if (optionMapRef.current.size === 0) {
                try {
                    const { db } = await import('../../../db/database');
                    const localOptionValues = await db.optionvalues.toArray();
                    localOptionValues?.forEach(ov => {
                        optionMapRef.current.set(String(ov.id), ov.value_name);
                        optionMapRef.current.set(ov.id, ov.value_name);
                    });
                    // If online, try to update from Supabase (background update)
                    if (isOnline) {
                        supabase.from('optionvalues').select('id, value_name').then(({ data }) => {
                            data?.forEach(ov => {
                                optionMapRef.current.set(String(ov.id), ov.value_name);
                                optionMapRef.current.set(ov.id, ov.value_name);
                            });
                        });
                    }
                } catch (e) {
                    console.warn('Failed to load option map:', e);
                }
            }
            // Use cached map
            const optionMap = optionMapRef.current;

            // If online, try to update option map from Supabase
            // Supabase update moved to background promise above to not block UI render

            // Fetch orders from last 48 hours to be safe
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            today.setDate(today.getDate() - 2);

            let ordersData = [];
            let supabaseFailed = false;

            // OFFLINE FIRST: If offline, skip Supabase entirely
            if (!isOnline) {
                console.log('📴 [useKDSData] Offline mode - loading from Dexie only');
                supabaseFailed = true;
            } else {
                // ONLINE: First sync any pending queue items to ensure local changes are saved
                try {
                    const { syncQueue } = await import('../../../services/offlineQueue');
                    const syncResult = await syncQueue();
                    if (syncResult.synced > 0) {
                        console.log(`🔄 Synced ${syncResult.synced} pending actions. Waiting for server DB...`);
                        // ⏱️ Wait 800ms to allow Supabase to process background triggers/indexes
                        await new Promise(resolve => setTimeout(resolve, 800));
                    }
                } catch (syncErr) {
                    console.warn('Queue sync failed, continuing with fetch:', syncErr);
                }

                // ONLINE: Try Supabase
                try {
                    log(`📡 [KDS] Calling RPC get_kds_orders with date: ${today.toISOString()}, businessId: ${businessId}`);

                    const { data, error } = await supabase.rpc('get_kds_orders', {
                        p_date: today.toISOString(),
                        p_business_id: businessId || null
                    }).abortSignal(signal);

                    if (error) {
                        console.error(`❌ [KDS] RPC Error:`, error);
                        throw error;
                    }

                    log(`📦 [KDS] RPC returned ${data?.length || 0} orders from Supabase`);
                    if (data && data.length > 0) {
                        log(`📦 [KDS] Sample order IDs: ${data.slice(0, 3).map(o => o.id).join(', ')}`);
                    }
                    ordersData = data || [];

                    // 💾 CACHE TO DEXIE: Save orders locally for offline access
                    try {
                        const { db } = await import('../../../db/database');

                        // 1. Get IDs of currently active orders from Supabase
                        const activeServerOrderIds = new Set(ordersData.map(o => o.id));

                        // 2. Cache the active ones
                        try {
                            // 2. Cache the active ones & MERGE with local pending changes
                            const mergedOrders = [];

                            for (const order of ordersData) {
                                // Robust ID handling: ensure it's saved correctly
                                const smartId = getSmartId(order.id); // Use helper to ensure type match with Dexie

                                // MAP RPC structure to Local structure
                                // RPC uses 'items_detail', local/Dexie expects 'order_items'
                                if (!order.order_items && order.items_detail) {
                                    order.order_items = order.items_detail;
                                }

                                // PROTECTION: Don't overwrite local changes that haven't synced yet!
                                const existingLocal = await db.orders.get(smartId);

                                // Logic: If we have a local version pending sync, check if server caught up
                                // (Unless server says completed, which overrides stuck local state)
                                if (existingLocal && existingLocal.pending_sync && order.order_status !== 'completed') {
                                    const serverUpdatedAt = new Date(order.updated_at || 0);
                                    const localUpdatedAt = new Date(existingLocal.updated_at || 0);

                                    // Check if server state matches our local optimistic state
                                    const serverMatchesLocal = order.order_status === existingLocal.order_status;

                                    // NEW: Maya's Fix - If server is strictly newer, it wins regardless of pending_sync
                                    if (serverUpdatedAt > localUpdatedAt) {
                                        console.log(`🔄 [MERGE] Server is newer for ${order.order_number} (${serverUpdatedAt.toISOString()} > ${localUpdatedAt.toISOString()}). Accepting server truth.`);
                                        // Proceed to 'put' logic below (which sets pending_sync: false and updates Dexie)
                                    } else if (serverMatchesLocal) {
                                        // ✅ Server caught up! We can safely use server data and clear the flag.
                                        // Proceed to 'put' logic below (which sets pending_sync: false)
                                    } else {
                                        // ⏳ Local is newer or Server is stale

                                        // ROBUST ITEM FETCHING
                                        let localItems = await db.order_items.where('order_id').equals(smartId).toArray();

                                        if (!localItems || localItems.length === 0) {
                                            const altId = typeof smartId === 'number' ? String(smartId) : Number(smartId);
                                            if (!isNaN(altId) || typeof altId === 'string') {
                                                localItems = await db.order_items.where('order_id').equals(altId).toArray();
                                            }
                                        }

                                        let finalItems = localItems || [];

                                        // FALLBACK: Use server items if local missing
                                        if ((!finalItems || finalItems.length === 0) && order.order_items) {
                                            console.warn(`⚠️ [FETCH] Missing local items for ${smartId}, using server items fallback`);
                                            finalItems = order.order_items;
                                        }

                                        // FIX #2: Enforce Item Consistency
                                        // If local order is 'in_progress', items MUST act as 'in_progress' for the UI logic to respect it.
                                        if (existingLocal.order_status === 'in_progress') {
                                            // console.log('Forcing items to match local status: in_progress');
                                            finalItems = finalItems.map(i => ({
                                                ...i,
                                                item_status: i.item_status === 'cancelled' ? 'cancelled' : 'in_progress'
                                            }));
                                        }

                                        // ✅ ROBUST MERGE
                                        mergedOrders.push({
                                            ...order,
                                            order_status: existingLocal.order_status,
                                            updated_at: existingLocal.updated_at || new Date().toISOString(),
                                            order_items: finalItems,
                                            pending_sync: true,
                                            _useLocalStatus: true
                                        });

                                        continue;
                                    }
                                }

                                // No pending changes - cache server version to Dexie
                                await db.orders.put({
                                    id: smartId,
                                    order_number: order.order_number,
                                    order_status: order.order_status,
                                    is_paid: order.is_paid,
                                    customer_id: order.customer_id,
                                    customer_name: order.customer_name,
                                    customer_phone: order.customer_phone,
                                    total_amount: order.total_amount,
                                    business_id: order.business_id || businessId,
                                    created_at: order.created_at,
                                    updated_at: order.updated_at || new Date().toISOString(),
                                    pending_sync: false // Mark as synced since it came from server
                                });

                                // Save order items and match status
                                if (order.order_items) {
                                    const payloadItemIds = new Set(order.order_items.map(i => i.id));

                                    // Update/Put seen items
                                    for (const item of order.order_items) {
                                        await db.order_items.put({
                                            id: item.id,
                                            order_id: smartId,
                                            menu_item_id: item.menu_item_id || item.menu_items?.id,
                                            quantity: item.quantity,
                                            price: item.price || item.menu_items?.price,
                                            mods: item.mods,
                                            notes: item.notes,
                                            item_status: item.item_status,
                                            is_early_delivered: !!item.is_early_delivered, // 🔥 PRESERVE FLAG
                                            course_stage: item.course_stage || 1,
                                            created_at: item.created_at || order.created_at
                                        });
                                    }

                                    // CRITICAL: Mark items NOT in payload as completed (Supabase filters them out)
                                    await db.order_items
                                        .where('order_id')
                                        .equals(smartId)
                                        .filter(i => !payloadItemIds.has(i.id))
                                        .modify({ item_status: 'completed' });
                                }

                                // Push server version to merged list
                                mergedOrders.push(order);
                            }

                            // ✅ USE MERGED DATA (local pending + server confirmed)
                            ordersData = mergedOrders;

                            const realCount = await db.orders.count();
                            const sampleOrders = await db.orders.limit(3).toArray();
                            console.log(`💾 [KDS→Dexie] Attempted to cache ${ordersData.length} orders. ACTUAL DB COUNT: ${realCount}`);
                            console.log(`💾 [KDS→Dexie] Sample IDs in Dexie: ${sampleOrders.map(o => o.id).join(', ')}`);
                        } catch (cacheErr) {
                            console.error('❌ Failed to cache orders to Dexie:', cacheErr);
                        }

                        // 2.5 Cache Menu Items (for offline display)
                        try {
                            const { data: menuItemsData } = await supabase.from('menu_items').select('*');
                            if (menuItemsData) {
                                await db.menu_items.clear(); // Refresh cache
                                await db.menu_items.bulkPut(menuItemsData);
                            }
                        } catch (e) { console.warn('Menu cache failed:', e); }

                        // 3. CLEANUP: Find orders in Dexie that ARE active locally but NOT in Supabase active list
                        const staleOrders = await db.orders
                            .where('order_status')
                            .anyOf(['in_progress', 'ready'])
                            .filter(o => {
                                // CRITICAL FIX: Staged orders (UUID-stage-X) MUST NOT be cleaned if parent is active
                                const baseId = String(o.id).replace(/-stage-\d+/, '').replace(/-ready$/, '');

                                return !activeServerOrderIds.has(o.id) && // Strict check
                                    !activeServerOrderIds.has(String(o.id)) && // Loose check
                                    !activeServerOrderIds.has(Number(o.id)) && // Loose check
                                    !activeServerOrderIds.has(baseId) && // CHECK PARENT/BASE ID
                                    !o.pending_sync &&
                                    !String(o.id).startsWith('L');
                            })
                            .toArray();

                        for (const stale of staleOrders) {
                            console.log(`🧹 Cleaning up stale order ${stale.order_number || stale.id} in Dexie (ID: ${stale.id})`);
                            await db.orders.update(stale.id, { order_status: 'completed' });
                            await db.order_items.where('order_id').equals(stale.id).modify({ item_status: 'completed' });
                        }

                        console.log(`💾 Synced Dexie cache with ${ordersData.length} active orders`);
                    } catch (cacheErr) {
                        console.warn('Failed to cache orders to Dexie:', cacheErr);
                    }
                } catch (err) {
                    console.warn('Supabase fetch failed, continuing with local data:', err?.message);
                    supabaseFailed = true;
                }
            } // End of isOnline block

            // ------------------------------------------------------------------
            // OFFLINE MODE: Load from Dexie
            // ------------------------------------------------------------------
            if (!isOnline || supabaseFailed) {
                console.log('📴 Loading from Dexie (offline mode)');
                try {
                    const { db } = await import('../../../db/database');

                    // FIXED: Make business_id filter optional since it might not match exactly for offline orders
                    const localOrders = await db.orders
                        .filter(o => {
                            const isToday = new Date(o.created_at) >= today;
                            // Note: 'pending' included - filtering happens in UI based on toggle
                            const isActiveState = ['in_progress', 'ready', 'new', 'pending'].includes(o.order_status);
                            // MATCH RPC: Also include completed but unpaid orders in active view
                            const isUnpaidCompleted = o.order_status === 'completed' && o.is_paid === false;

                            const isPending = o.pending_sync === true || o.is_offline === true;
                            // Loose business_id check: skip if we don't have a businessId, or match loosely
                            const businessMatch = !businessId || String(o.business_id) === String(businessId);
                            return businessMatch && (((isActiveState || isUnpaidCompleted) && isToday) || isPending);
                        })
                        .toArray();

                    console.log(`📴 [OFFLINE] Query returned ${localOrders.length} orders from Dexie`);

                    if (localOrders && localOrders.length > 0) {
                        const localOrderIds = localOrders.map(o => o.id);
                        const localItems = await db.order_items.toArray();
                        const orderItems = localItems.filter(i =>
                            i.order_id && localOrderIds.some(oid => String(oid) === String(i.order_id))
                        );

                        const menuItems = await db.menu_items.toArray();
                        const menuMap = new Map(menuItems.map(m => [m.id, m]));

                        ordersData = localOrders.map(order => ({
                            id: order.id,
                            orderNumber: order.order_number,
                            customerName: order.customer_name || 'אורח',
                            customerPhone: order.customer_phone,
                            isPaid: order.is_paid,
                            total: order.total_amount,
                            createdAt: order.created_at,
                            updatedAt: order.updated_at,
                            orderStatus: order.order_status,
                            pendingSync: order.pending_sync || false,
                            items: orderItems
                                .filter(i => String(i.order_id) === String(order.id))
                                .map(item => {
                                    const menuItem = menuMap.get(item.menu_item_id);

                                    // FALLBACK: If menu items not in Dexie yet, don't hide the order!
                                    // Construct a basic item info using what we have
                                    const name = menuItem?.name || item.name || 'פריט מהתפריט';
                                    const price = item.price || menuItem?.price || 0;

                                    return {
                                        id: item.id,
                                        name: name,
                                        price: price,
                                        mods: item.mods || [],
                                        notes: item.notes,
                                        item_status: item.item_status,
                                        is_early_delivered: !!item.is_early_delivered, // 🔥 PRESERVE FLAG
                                        course_stage: item.course_stage || 1,
                                        quantity: item.quantity,
                                        order_id: item.order_id,
                                        menu_items: {
                                            name: name,
                                            price: price,
                                            kds_routing_logic: menuItem?.kds_routing_logic || 'MADE_TO_ORDER',
                                            is_prep_required: menuItem?.is_prep_required !== false
                                        }
                                    };
                                })
                        }));

                        console.log(`📴 Loaded ${ordersData.length} orders from Dexie (offline)`);
                    }
                } catch (dexieErr) {
                    console.error('❌ Dexie load failed:', dexieErr);
                }

                // NOTE: supabaseFailed is NOT reset here - we need it to skip Supabase-only operations below
            } // End of offline loading block


            // Skip rest of Supabase-only code if we got data from Dexie
            // IMPORTANT: Only run if online - these are Supabase-only operations
            if (!supabaseFailed && isOnline) {

                // console.log(`📦 [useKDSData] Total orders fetched: ${ordersData?.length || 0}`);

                // WORKAROUND: The RPC might filter out 'ready' items from 'in_progress' orders.
                // We need to fetch 'ready' items manually for these orders to show split courses in "Completed".
                if (ordersData && ordersData.length > 0) {
                    // Filter out legacy numeric IDs to avoid Supabase "invalid uuid" error
                    const orderIds = ordersData
                        .map(o => o.id)
                        .filter(id => typeof id === 'string' && id.length > 20 && id.includes('-'));

                    if (orderIds.length > 0) {
                        try {
                            const { data: readyItems } = await supabase
                                .from('order_items')
                                .select('id, mods, notes, item_status, is_early_delivered, course_stage, quantity, order_id, menu_items!inner(name, price, kds_routing_logic, is_prep_required)')
                                .in('order_id', orderIds)
                                .in('item_status', ['ready', 'completed']) // Fetch both ready and completed items
                                .abortSignal(signal);

                            if (readyItems && readyItems.length > 0) {
                                // Merge ready items into active orders
                                ordersData.forEach(order => {
                                    if (!order.order_items) order.order_items = [];
                                    const missingItems = readyItems.filter(ri =>
                                        ri.order_id === order.id &&
                                        !order.order_items.some(oi => oi.id === ri.id)
                                    );
                                    if (missingItems.length > 0) {
                                        const mappedItems = missingItems.map(mi => ({
                                            ...mi,
                                            menu_items: mi.menu_items || { name: 'Unknown', price: 0 },
                                            item_status: 'ready' // Force status for consistency
                                        }));
                                        order.order_items = [...order.order_items, ...mappedItems];
                                    }
                                });
                            }
                        } catch (mergeErr) {
                            console.error('Error merging ready items:', mergeErr);
                        }
                    }
                }

                // ⚠️ SAFETY NET: Fetch orders that have ANY active items, regardless of order_status.
                // This ensures orders with new items added (even if previously completed) show up!
                try {
                    // Look back 12 hours to catch any revived orders from the current shift
                    const lookbackTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

                    // Fetch orders with active items (in_progress, new, pending, ready)
                    const { data: rescueOrders } = await supabase
                        .from('orders')
                        .select('*, order_items!inner(id, item_status, is_early_delivered, mods, notes, course_stage, quantity, menu_items!inner(name, price, kds_routing_logic, is_prep_required))')
                        .gt('updated_at', lookbackTime)
                        .in('order_items.item_status', ['in_progress', 'new', 'pending', 'ready'])
                        .eq('business_id', businessId)
                        .abortSignal(signal);

                    if (rescueOrders && rescueOrders.length > 0) {
                        console.log(`🛟 Rescued ${rescueOrders.length} orders with active items`);

                        // Merge rescued orders into main list if not already present
                        rescueOrders.forEach(rescueOrder => {
                            const existingIndex = ordersData.findIndex(o => o.id === rescueOrder.id);
                            if (existingIndex === -1) {
                                // Not in list - add it
                                ordersData.push(rescueOrder);
                            } else {
                                // Already in list - merge items that might be missing
                                const existing = ordersData[existingIndex];
                                rescueOrder.order_items.forEach(ri => {
                                    if (!existing.order_items.some(oi => oi.id === ri.id)) {
                                        existing.order_items.push(ri);
                                    }
                                });
                            }
                        });
                    }
                } catch (rescueErr) {
                    console.warn('Rescue query failed (non-critical):', rescueErr);
                }

                // 🔌 OFFLINE ORDERS: Merge local Dexie orders that haven't been synced yet
                try {
                    const { db } = await import('../../../db/database');
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // DIAGNOSTIC LOG: See ALL local orders to debug why filtering might skip them
                    const allLocal = await db.orders.toArray();
                    console.log(`📋 [KDS-Diagnostic] Total local orders in Dexie: ${allLocal.length}`,
                        allLocal.slice(0, 5).map(o => ({ id: o.id, num: o.order_number, bid: o.business_id, sync: o.pending_sync })));

                    // 📅 DATE LIMIT: Only consider orders from yesterday 00:00 onwards
                    // This prevents old stuck orders from polluting the KDS
                    const yesterday = new Date();
                    yesterday.setHours(0, 0, 0, 0); // Start of today
                    yesterday.setDate(yesterday.getDate() - 1); // Start of yesterday
                    const yesterdayISO = yesterday.toISOString();

                    // 🧹 AGGRESSIVE KDS CLEANUP: Remove completed/cancelled orders older than 24h
                    // This is VITAL for weak tablets to prevent Dexie from growing to 1000s of records.
                    const cleanDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    const oldCompleted = await db.orders
                        .where('updated_at')
                        .below(cleanDate)
                        .filter(o => ['completed', 'cancelled'].includes(o.order_status) && !o.pending_sync)
                        .primaryKeys();

                    if (oldCompleted.length > 0) {
                        log(`🧹 KDS Purge: Removing ${oldCompleted.length} old completed orders from local device`);
                        await db.orders.bulkDelete(oldCompleted);
                        // Also clean items related to these orders
                        await db.order_items.where('order_id').anyOf(oldCompleted).delete();
                    }

                    // Get local orders using INDEXES where possible for speed
                    const localOrders = await db.orders
                        .where('order_status')
                        .anyOf(['in_progress', 'ready', 'new', 'pending'])
                        .filter(o => {
                            // 1. Business ID Check
                            if (businessId && String(o.business_id) !== String(businessId)) return false;

                            // 2. DATE CHECK: Only orders from yesterday onwards
                            const orderDate = o.created_at || o.updated_at;
                            if (orderDate && orderDate < yesterdayISO) return false;

                            // 3. Sync Status Check - ONLY take if NOT yet synced
                            const hasServerId = !!o.serverOrderId;
                            const isPending = o.pending_sync === true || o.is_offline === true;

                            if (hasServerId) return false;
                            return isPending && !o._processing;
                        })
                        .toArray();

                    if (localOrders.length > 0) log(`📴 [KDS] Loaded ${localOrders.length} local orders for display`);

                    if (localOrders && localOrders.length > 0) {
                        console.log(`📴 Found ${localOrders.length} truly pending offline orders in Dexie`);

                        // Get items for these orders
                        const localOrderIds = localOrders.map(o => o.id);
                        const localItems = await db.order_items
                            .filter(item => localOrderIds.includes(item.order_id))
                            .toArray();

                        // Get menu item names
                        const menuItemIds = [...new Set(localItems.map(i => i.menu_item_id))];
                        const menuItems = await db.menu_items
                            .where('id')
                            .anyOf(menuItemIds)
                            .toArray();
                        const menuMap = new Map(menuItems.map(m => [m.id, m]));

                        console.log(`📴 [KDS] Mapping ${localItems.length} items for ${localOrders.length} pending orders`);

                        // Build order objects in the same format as Supabase
                        localOrders.forEach(localOrder => {
                            console.log(`🔍 [OFFLINE-CHECK] Checking ${localOrder.order_number}:`, {
                                localId: String(localOrder.id).slice(0, 8),
                                localStatus: localOrder.order_status,
                                hasPendingSync: localOrder.pending_sync
                            });

                            // IMPROVED MATCHING: Check ID and ServerOrderId against everything in ordersData
                            const existingIdx = ordersData?.findIndex(o => {
                                const idMatch = String(o.id) === String(localOrder.id);
                                const serverIdMatch = localOrder.serverOrderId && String(o.id) === String(localOrder.serverOrderId);
                                const numberMatch = o.order_number &&
                                    localOrder.order_number &&
                                    String(o.order_number) === String(localOrder.order_number) &&
                                    !String(localOrder.order_number).startsWith('L');
                                return idMatch || serverIdMatch || numberMatch;
                            }) ?? -1;

                            if (existingIdx !== -1) {
                                const existing = ordersData[existingIdx];

                                console.log(`🎯 [MATCH] Found in ordersData:`, {
                                    existingStatus: existing.order_status,
                                    existingHasFlag: !!existing._useLocalStatus,
                                    matchIndex: existingIdx
                                });

                                // ✅ DOUBLE SAFETY NET: Check if existing version has correct local status

                                // Case 1: Already merged correctly (has _useLocalStatus or pending_sync flag)
                                if (existing._useLocalStatus || (existing.pending_sync && existing.order_status === localOrder.order_status)) {
                                    console.log(`✅ [OFFLINE-SKIP] Already has _useLocalStatus flag or matches status`);
                                    return;
                                }

                                // 🟢 FORCE OVERRIDE if local is 'in_progress' (Undo case safety net)
                                // Even if pending_sync was cleared, if we have a local in_progress copy, we show it!
                                if (localOrder.order_status === 'in_progress') {
                                    console.log(`🔄 [OFFLINE-FORCE] Enforcing local in_progress for ${localOrder.order_number}`);
                                    ordersData[existingIdx] = {
                                        ...existing,
                                        order_status: 'in_progress',
                                        updated_at: localOrder.updated_at,
                                        _useLocalStatus: true,
                                        pending_sync: localOrder.pending_sync // Preserve actual sync state
                                    };
                                    return;
                                }

                                // Case 2: Existing has pending_sync BUT wrong status
                                if (existing.pending_sync && existing.order_status !== localOrder.order_status) {
                                    console.warn(`⚠️ Conflicting pending_sync statuses detected for ${localOrder.order_number} - using local Dexie version`);
                                }

                                // Case 3: Local has pending_sync but existing doesn't (or has wrong status) - OVERRIDE!
                                if (localOrder.pending_sync && !existing._useLocalStatus) {
                                    console.log(`🔄 [OFFLINE-OVERRIDE] Overriding server status: ${existing.order_status} → ${localOrder.order_status}`);

                                    // ✅ SIMPLE FIX: Keep server data (especially items with full menu_items!), just override status
                                    // We DO NOT reconstruct items from local Dexie data because Dexie might lack the full joined menu_items object,
                                    // causing filters downstream to drop the items as "invalid".
                                    ordersData[existingIdx] = {
                                        ...existing,  // Keep everything from server (including items with menu_items!)
                                        order_status: localOrder.order_status,  // Override status
                                        customer_name: localOrder.customer_name, // Override customer info if local is newer/pending
                                        customer_phone: localOrder.customer_phone,
                                        updated_at: localOrder.updated_at,
                                        pending_sync: true,
                                        _useLocalStatus: true
                                        // We intentionally leave order_items alone so they retain their server attributes
                                    };

                                    return; // Overridden successfully
                                }

                                // Case 4: No conflict - it's truly a duplicate, skip
                                console.log(`⏭️ [OFFLINE-SKIP] No override needed`);
                                return;
                            }

                            // If we reached here, order is NOT in ordersData - add it
                            const orderItems = localItems
                                .filter(i => String(i.order_id) === String(localOrder.id))
                                .map(item => {
                                    const menuItem = menuMap.get(item.menu_item_id);
                                    const name = menuItem?.name || item.name || 'פריט חדש';
                                    const price = item.price || menuItem?.price || 0;

                                    return {
                                        id: item.id,
                                        mods: item.mods || [],
                                        notes: item.notes,
                                        item_status: item.item_status,
                                        is_early_delivered: !!item.is_early_delivered, // 🔥 PRESERVE FLAG
                                        course_stage: item.course_stage || 1,
                                        quantity: item.quantity,
                                        order_id: item.order_id,
                                        menu_items: {
                                            name: name,
                                            price: price,
                                            kds_routing_logic: menuItem?.kds_routing_logic || 'MADE_TO_ORDER',
                                            is_prep_required: menuItem?.is_prep_required !== false
                                        }
                                    };
                                });

                            const formattedLocalOrder = {
                                id: localOrder.id,
                                order_number: localOrder.order_number,
                                order_status: localOrder.order_status,
                                is_paid: localOrder.is_paid,
                                customer_name: localOrder.customer_name,
                                customer_phone: localOrder.customer_phone,
                                total_amount: localOrder.total_amount,
                                created_at: localOrder.created_at,
                                updated_at: localOrder.updated_at,
                                ready_at: localOrder.ready_at,
                                business_id: localOrder.business_id,
                                is_offline: true,
                                pending_sync: true,
                                _useLocalStatus: true,  // Mark it!
                                order_items: orderItems
                            };

                            if (!ordersData) ordersData = [];
                            ordersData.push(formattedLocalOrder);
                        });

                        console.log(`✅ Merged ${localOrders.length} offline orders into KDS`);
                    }
                } catch (offlineErr) {
                    console.warn('Failed to load offline orders:', offlineErr);
                }
            } // END of if (!supabaseFailed)

            // NOTE: Completed orders are NOT fetched for active KDS.
            // They belong only in History tab and are fetched separately when viewing history.

            // 🔧 FIX: Load menu items from Dexie for fallback name lookup
            // This ensures we can display item names even when RPC's LEFT JOIN fails
            let menuMapForProcessing = new Map();
            try {
                const allMenuItems = await db.menu_items.toArray();
                menuMapForProcessing = new Map(allMenuItems.map(m => [m.id, m]));
            } catch (e) { console.warn('Could not load menu items for processing:', e); }

            const processedOrders = [];

            // Map for fast lookup of updates
            const recentUpdates = recentLocalUpdatesRef.current;
            const now = Date.now();

            log('🚀 [START-PROCESSING] About to process ' + (ordersData?.length || 0) + ' orders');

            (ordersData || []).forEach((order, idx) => {
                // ANTI-FLICKER: Check for recent local override
                const recentUpdate = recentUpdates.get(order.id) || recentUpdates.get(order.serverOrderId);
                if (recentUpdate && now - recentUpdate.timestamp < 5000) {
                    if (order.order_status !== recentUpdate.status) {
                        console.log(`🛡️ [ANTI-FLICKER] Overriding ${order.order_status} -> ${recentUpdate.status} for ${order.order_number}`);
                        order.order_status = recentUpdate.status;

                        // If moving to completed/ready, implicitly complete items to prevent zombies
                        if (['completed', 'ready'].includes(recentUpdate.status)) {
                            if (order.order_items) {
                                order.order_items.forEach(i => i.item_status = recentUpdate.status);
                            }
                        }
                    }
                }

                // CRITICAL: Map various source names to order_items
                // - RPC returns items_detail
                // - Offline mode uses 'items'
                if (!order.order_items && order.items_detail) {
                    order.order_items = order.items_detail;
                }
                if (!order.order_items && order.items) {
                    order.order_items = order.items;
                }

                // Check if order has ANY active items (in_progress, new, pending)
                // If so, it belongs in Active KDS even if order_status is 'completed'
                const hasActiveItems = (order.order_items || []).some(item =>
                    item.item_status === 'in_progress' ||
                    item.item_status === 'new' ||
                    item.item_status === 'pending' ||
                    item.item_status === 'ready' ||
                    item.item_status === 'held'
                );

                // Only skip to history if order is completed AND has no active items
                if (order.order_status === 'completed' && !hasActiveItems) {
                    if (idx < 3) log(`⏭️ [DIAG] Skipping order ${order.order_number} - completed with no active items`);
                    return; // Skip entirely - belongs in History tab
                }

                // Filter items logic
                const rawItems = (order.order_items || [])
                    .filter(item => {
                        // LOGGING for specific diagnosis
                        const isTargetOrder = String(order.order_number) === '1790' || order.id === 'd264b6c9-3dcd-4b0f-adb3-8d50f355906f';

                        // 🟢 NUCLEAR BYPASS: If locally in_progress, NEVER drop items (except cancelled)
                        // This ensures Undo orders ALWAYS display, even with missing metadata
                        const isLocalInProgress = (order._useLocalStatus || order.pending_sync) && order.order_status === 'in_progress';

                        if (isLocalInProgress) {
                            if (item.item_status === 'cancelled') return false;

                            // ✅ SAFETY: Still validate basic data integrity
                            const cachedMenuItem = menuMapForProcessing.get(item.menu_item_id);
                            const hasName = item.menu_items?.name || item.name || cachedMenuItem?.name;

                            if (!hasName) {
                                console.warn(`⚠️ [NUCLEAR-BYPASS] Item ${item.id} lacks name - keeping anyway but marking as "Unknown"`);
                                // Don't drop it, but we'll handle it in mapping below by providing fallback names
                            }

                            if (isTargetOrder) console.log(`🟢 [ITEM-FILTER] KEEPING item ${item.id} (Nuclear Bypass)`);
                            return true; // Keep everything else
                        }

                        // 🔴 STANDARD FILTERING (Server Data only)

                        // 1. Drop cancelled
                        if (item.item_status === 'cancelled') return false;

                        const menuItemFromCache = menuMapForProcessing.get(item.menu_item_id);
                        const hasName = item.menu_items?.name || item.name || menuItemFromCache?.name;

                        // FIX: Don't drop items with no name, just give them a fallback.
                        // This supports custom items or virtual items (like delivery fees) that might not be in menu_items table.
                        if (!hasName) {
                            if (isTargetOrder) console.log(`🔍 [ITEM-FILTER] Keeping item ${item.id} with fallback name`);
                        }

                        // 3. (REMOVED) Drop Completed if order not in_progress
                        // Old Logic: if (item.item_status === 'completed' && order.order_status !== 'in_progress') return false;
                        // Fix: We need completed items to display orders in the "Completed/Ready" column!

                        // 4. Routing Logic (Grab & Go)
                        const kdsLogic = item.menu_items?.kds_routing_logic;
                        let hasOverride = false;
                        let mods = item.mods;
                        if (typeof mods === 'string') {
                            try {
                                if (mods.includes('__KDS_OVERRIDE__')) { hasOverride = true; }
                                else { const parsed = JSON.parse(mods); if (Array.isArray(parsed) && parsed.includes('__KDS_OVERRIDE__')) hasOverride = true; }
                            } catch (e) { if (mods.includes('__KDS_OVERRIDE__')) hasOverride = true; }
                        } else if (Array.isArray(mods)) { if (mods.includes('__KDS_OVERRIDE__')) hasOverride = true; }
                        else if (typeof mods === 'object' && mods?.kds_override) { hasOverride = true; }

                        if ((kdsLogic === 'GRAB_AND_GO' || kdsLogic === 'CONDITIONAL') && !hasOverride) return false;

                        return true;
                    })
                    .map(item => {
                        // VISUAL OVERRIDE: If we forced a completed item to show, make it look 'in_progress'
                        const isLocalInProgress = (order._useLocalStatus || order.pending_sync) && order.order_status === 'in_progress';

                        const visualStatus = (isLocalInProgress && ['completed', 'ready'].includes(item.item_status))
                            ? 'in_progress'
                            : item.item_status;

                        let modsArray = [];
                        if (item.mods) {
                            try {
                                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                                if (Array.isArray(parsed)) {
                                    modsArray = parsed.map(m => {
                                        if (typeof m === 'object' && m?.value_name) return m.value_name;
                                        return String(m);
                                    }).filter(m => m && !m.toLowerCase().includes('default') && m !== 'רגיל' && !String(m).includes('KDS_OVERRIDE'));
                                }
                            } catch (e) { /* ignore */ }
                        }

                        // Add Custom Note if exists
                        if (item.notes) {
                            modsArray.push({ name: item.notes, is_note: true });
                        }

                        // Construct Modifiers for React
                        const structuredModifiers = modsArray.map(mod => {
                            if (typeof mod === 'object' && mod.is_note) {
                                return { text: mod.name, color: 'mod-color-purple', isNote: true };
                            }

                            const modName = typeof mod === 'string' ? mod : (mod.name || String(mod));
                            let color = 'mod-color-gray';

                            if (modName.includes('סויה')) color = 'mod-color-lightgreen';
                            else if (modName.includes('שיבולת')) color = 'mod-color-beige';
                            else if (modName.includes('שקדים')) color = 'mod-color-lightyellow';
                            else if (modName.includes('נטול')) color = 'mod-color-blue';
                            else if (modName.includes('רותח')) color = 'mod-color-red';
                            else if (modName.includes('קצף') && !modName.includes('בלי')) color = 'mod-color-foam-up';
                            else if (modName.includes('בלי קצף')) color = 'mod-color-foam-none';

                            return { text: modName, color: color, isNote: false };
                        });

                        // FALLBACK: Try menuMapForProcessing if menu_items is missing from RPC
                        const menuItemFromCache = menuMapForProcessing.get(item.menu_item_id);
                        const itemName = item.menu_items?.name || item.name || menuItemFromCache?.name || 'פריט';
                        const itemPrice = item.menu_items?.price || item.price || menuItemFromCache?.price || 0;
                        const category = item.menu_items?.category || menuItemFromCache?.category || '';
                        // ROBUST: Use menu_items.id if available, fall back to FK menu_item_id, or item.id as last resort
                        const menuItemId = item.menu_items?.id || item.menu_item_id || item.id;

                        const modsKey = modsArray.map(m => typeof m === 'object' ? m.name : m).sort().join('|');

                        const isEarlyDelivered = item.is_early_delivered || (item.item_status === 'ready' && order.order_status !== 'ready' && order.order_status !== 'completed');

                        return {
                            id: item.id,
                            menuItemId: menuItemId,
                            name: itemName,
                            modifiers: structuredModifiers,
                            quantity: item.quantity,
                            status: visualStatus,
                            item_status: item.item_status, // 🆕 CRITICAL: Keep raw status for grouping logic
                            price: itemPrice,
                            category: category,
                            modsKey: modsKey,
                            course_stage: item.course_stage || 1,
                            item_fired_at: item.item_fired_at,
                            is_early_delivered: isEarlyDelivered
                        };
                    });

                if (String(order.order_number) === '1790' || order.id === 'd264b6c9-3dcd-4b0f-adb3-8d50f355906f') {
                    console.log(`🔍 [AFTER-FILTER] Order ${order.order_number} has ${rawItems.length} items after filtering`);
                }

                // Skip orders with no items after filtering
                if (!rawItems || rawItems.length === 0) {
                    if (String(order.order_number) === '1790' || order.id === 'd264b6c9-3dcd-4b0f-adb3-8d50f355906f') {
                        console.log(`❌ [SKIP] Order ${order.order_number} skipped - no items after filter!`);
                    }
                    return;
                }

                // Calculate total order amount from ALL non-cancelled items
                const itemsForTotal = (order.order_items || []).filter(i => i.item_status !== 'cancelled');

                const calculatedTotal = itemsForTotal.reduce((sum, i) => sum + (i.price || i.menu_items?.price || 0) * (i.quantity || 1), 0);
                const totalOrderAmount = order.total_amount || calculatedTotal;

                // Calculate unpaid amount
                const paidAmount = order.paid_amount || 0;
                const unpaidAmount = totalOrderAmount - paidAmount;

                const baseOrder = {
                    id: order.id,
                    // CRITICAL: DO NOT CHANGE THIS - ORDER NUMBER MUST COME FROM SUPABASE ONLY!
                    // If order_number is missing (e.g. newly created local order), show truncated ID instead of empty.
                    orderNumber: order.order_number || (order.id ? order.id.toString().slice(-4) : 'PENDING'),
                    customerName: order.customer_name || 'אורח',
                    customerPhone: order.customer_phone,
                    customerId: order.customer_id,
                    isPaid: order.is_paid,
                    totalAmount: unpaidAmount > 0 ? unpaidAmount : totalOrderAmount, // Show unpaid amount, or full if nothing paid
                    paidAmount: paidAmount,
                    fullTotalAmount: totalOrderAmount,
                    timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                    fired_at: order.fired_at,
                    ready_at: order.ready_at,
                    updated_at: order.updated_at,
                    payment_method: order.payment_method,
                    order_type: order.order_type || 'dine_in',
                    delivery_address: order.delivery_address,
                    delivery_fee: order.delivery_fee,
                    delivery_notes: order.delivery_notes,
                    is_refund: order.is_refund || (Number(order.refund_amount) > 0),
                    refund_amount: Number(order.refund_amount) || 0,
                    refund_method: order.refund_method || order.payment_method,
                    totalOriginalAmount: totalOrderAmount + (Number(order.refund_amount) || 0)
                };

                // Completed orders are already filtered out at the start of the loop

                // Skip orders with no items after filtering
                if (!rawItems || rawItems.length === 0) return;

                // NEW GROUPING LOGIC: Group items by "Display Status"
                // This allows one order to have multiple cards (e.g., one 'new' card and one 'in_progress' card)
                // and they will automatically MERGE when the 'new' card is moved to 'in_progress'.
                const itemsByGroup = rawItems.reduce((acc, item) => {
                    let groupKey;
                    if (item.item_status === 'held') {
                        groupKey = 'delayed';
                    } else if (item.item_status === 'new' || item.item_status === 'pending') {
                        groupKey = 'new';
                    } else {
                        groupKey = 'active'; // in_progress, ready, etc.
                    }

                    if (!acc[groupKey]) acc[groupKey] = [];
                    acc[groupKey].push(item);
                    return acc;
                }, {});

                // Process each group
                Object.entries(itemsByGroup).forEach(([groupKey, groupItems]) => {
                    const cardId = groupKey === 'active' ? order.id : `${order.id}-${groupKey}`;

                    let cardType, cardStatus;
                    const allReady = groupItems.every(i => ['ready', 'completed', 'cancelled'].includes(i.item_status));

                    if (groupKey === 'new') {
                        cardType = 'active';
                        cardStatus = 'new';
                    } else if (groupKey === 'delayed') {
                        cardType = 'delayed';
                        cardStatus = 'pending';
                    } else {
                        // active group (in_progress / ready)
                        const isOrderReadyOrCompleted = order.order_status === 'ready' || order.order_status === 'completed';
                        if (isOrderReadyOrCompleted || allReady) {
                            cardType = 'ready';
                            cardStatus = 'ready';
                        } else {
                            cardType = 'active';
                            cardStatus = 'in_progress';
                        }
                    }

                    const groupedItems = groupOrderItems(groupItems);
                    const displayItems = sortItems(groupedItems);

                    processedOrders.push({
                        ...baseOrder,
                        id: cardId,
                        originalOrderId: order.id,
                        courseStage: groupItems[0]?.course_stage || 1,
                        created_at: order.created_at,
                        fired_at: groupItems[0]?.item_fired_at || order.created_at,
                        isSecondCourse: groupItems.some(i => i.course_stage === 2),
                        hasPendingItems: rawItems.some(i => i.item_status === 'completed'),
                        items: displayItems,
                        type: cardType,
                        orderStatus: cardStatus
                    });
                });
            });

            // Separate and Sort
            const current = processedOrders
                .filter(o => (o.type === 'active' || o.type === 'delayed'))
                .sort((a, b) => {
                    // 1. Force 'delayed' (Second Course) to the end (Left side in RTL -> Max Value)
                    const aDelayed = a.type === 'delayed';
                    const bDelayed = b.type === 'delayed';
                    if (aDelayed && !bDelayed) return 1;
                    if (!aDelayed && bDelayed) return -1;

                    // 2. Sort by Fired At (Priority: Oldest Fired -> Right side for RTL KDS)
                    // This ensures freshly fired items appear as "new" tasks chronologically
                    const aTime = new Date(a.fired_at || a.created_at || 0).getTime();
                    const bTime = new Date(b.fired_at || b.created_at || 0).getTime();
                    return aTime - bTime;
                });

            // LOG 4: Final Summary
            // SORT BY ready_at ASC so newest ready = end of array = left side in RTL
            // STABILITY: Never use updated_at for sorting as it changes on every item edit/sync
            const completed = processedOrders.filter(o =>
                (o.type === 'ready' || o.type === 'active_ready_split' || o.type === 'unpaid_delivered')
            ).sort((a, b) => {
                // 1. Priority: Unpaid comes FIRST (Index 0 = Right side in RTL reversed??)
                // verified hypothesis: Index 0 is Right-most. User wants Unpaid Right-most.
                if (a.isPaid !== b.isPaid) {
                    return a.isPaid ? 1 : -1; // Unpaid (false) comes before Paid (true)
                }

                // 2. Priority: Newest time comes FIRST
                const aTime = new Date(a.ready_at || a.created_at || 0).getTime();
                const bTime = new Date(b.ready_at || b.created_at || 0).getTime();

                return bTime - aTime; // Descending Sort (Newest First)
            });

            // LOG 4: Final Summary
            log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            log('📊 [FETCH-RESULT]', new Date().toISOString());
            log('📋 Setting currentOrders:', current.length, 'orders', current.map(o => o.id).slice(0, 5));
            log('📋 Setting completedOrders:', completed.length, 'orders', completed.map(o => o.id).slice(0, 5));

            setCurrentOrders(current);
            setCompletedOrders(completed);
            setLastUpdated(new Date());
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('שגיאה בטעינת הזמנות:', err);
                // CRITICAL: If offline, do NOT clear the state - keep existing orders visible
                if (!navigator.onLine) {
                    console.log('📴 Offline error - keeping existing orders in state');
                    return; // Early return to preserve state
                }
            }
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]); // Added currentUser to dependency array

    const handleSendSms = async (orderId, customerName, phone) => {
        // Fast exit if no phone or obvious guest/placeholder name
        if (!phone || !phone.match(/^\d+$/) || phone.length < 9) {
            console.log('⏭️ Skipping SMS: Invalid or missing phone number');
            return;
        }

        // 📴 OFFLINE CHECK: If offline, don't even try and don't show the error modal
        if (!navigator.onLine) {
            console.log('📴 Offline: Skipping SMS and showing notification');
            setSmsToast({
                show: true,
                message: 'הודעת ה-SMS לא נשלחה (אין חיבור לאינטרנט)',
                isWarning: true
            });
            setTimeout(() => setSmsToast(null), 3000);
            return;
        }

        setIsSendingSms(true);
        setErrorModal(null);

        const message = `היי ${customerName || 'אורח'}, ההזמנה שלכם מוכנה! 🎉, מוזמנים לעגלה לאסוף אותה`;

        const result = await sendSms(phone, message);

        setIsSendingSms(false);

        if (result.success) {
            setSmsToast({ show: true, message: 'הודעה נשלחה בהצלחה!' });
            setTimeout(() => setSmsToast(null), 1000);
        } else {
            if (result.isBlocked) {
                setSmsToast({ show: true, message: result.error, isError: true });
                setTimeout(() => setSmsToast(null), 3000);
            } else {
                setErrorModal({
                    show: true,
                    title: 'שגיאה בשליחת הודעה',
                    message: `לא התקבל אישור שליחה עבור ${customerName} `,
                    details: result.error,
                    retryLabel: 'נסה שוב',
                    onRetry: () => handleSendSms(orderId, customerName, phone)
                });
            }
        }
    };

    const updateOrderStatus = async (orderId, currentStatus) => {
        const businessId = currentUser?.business_id;
        log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        log('🔄 [STATUS-UPDATE] START', new Date().toISOString());
        log('📋 Input:', { orderId, currentStatus, online: navigator.onLine });
        log('📊 Current State BEFORE:', {
            currentOrdersCount: currentOrders.length,
            completedOrdersCount: completedOrders.length,
            currentOrderIds: currentOrders.map(o => o.id).slice(0, 5),
            completedOrderIds: completedOrders.map(o => o.id).slice(0, 5)
        });

        // 1. Calculate Logic first (before any Offline/Online split)
        const statusLower = (currentStatus || '').toLowerCase();
        let nextStatus = 'in_progress';

        // Search for the order in both lists to ensure we have its data
        const order = currentOrders.find(o => o.id === orderId) || completedOrders.find(o => o.id === orderId);
        log('🔍 Found order:', order ? { id: order.id, status: order.orderStatus, type: order.type } : 'NOT FOUND');

        const hasInProgress = order?.items?.some(i => i.status === 'in_progress' || i.status === 'new' || !i.status);

        if (currentStatus === 'undo_ready') {
            nextStatus = 'in_progress';
        } else if (statusLower === 'completed' || statusLower === 'shipped') {
            // If already completed/shipped or explicitly told to move to these, keep it that way
            nextStatus = statusLower;
        } else if (statusLower === 'pending') {
            // Pending orders (e.g. deliveries) go to 'new' first (acknowledgment)
            nextStatus = 'new';
        } else if (statusLower === 'new') {
            // 'new' orders go to in_progress (start preparation)
            nextStatus = 'in_progress';
        } else if (statusLower === 'in_progress' || hasInProgress) {
            nextStatus = 'ready';
        } else if (statusLower === 'ready' || currentStatus === 'ready') {
            // Logic for Delivery: Ready -> Shipped
            // Logic for Dine-in/Takeway: Ready -> Completed
            if (order?.type === 'delivery' || order?.order_type === 'delivery') {
                nextStatus = 'shipped';
            } else {
                nextStatus = 'completed';
            }
        }

        log('🎯 Calculated nextStatus:', nextStatus);

        const smartOrderId = getSmartId(orderId);

        // ANTI-FLICKER: Record update immediately
        recentLocalUpdatesRef.current.set(smartOrderId, { status: nextStatus, timestamp: Date.now() });
        if (orderId !== smartOrderId) {
            recentLocalUpdatesRef.current.set(orderId, { status: nextStatus, timestamp: Date.now() });
        }

        // Helper to check if ID is likely a valid UUID
        const isUUID = (id) => typeof id === 'string' && id.length > 20 && id.includes('-');

        // CRITICAL FIX: Treat numeric IDs or short IDs as Local Only to prevent Supabase errors
        const isLocalOnly = String(orderId).startsWith('L') ||
            order?.is_offline ||
            String(orderId).length < 20 || // FORCE SAFEGUARD: Short IDs are ALWAYS local
            !isUUID(orderId);

        // 2. OFFLINE HANDLING (or Local Only)
        // We force this path if it's a local order that hasn't synced yet, even if we are online now
        if (!navigator.onLine || isLocalOnly) {
            console.log(`📴 Handling status update locally (Offline: ${!navigator.onLine}, Next: ${nextStatus}, Action: ${currentStatus})`);
            try {
                const { db } = await import('../../../db/database');
                const { queueAction } = await import('../../../services/offlineQueue');

                let itemStatus = nextStatus === 'completed' ? 'completed' :
                    nextStatus === 'ready' ? 'ready' : 'in_progress';

                // Specific override for UNDO action
                if (currentStatus === 'undo_ready') {
                    nextStatus = 'in_progress';
                    itemStatus = 'in_progress';
                }

                console.log(`📴 Marking local order ${smartOrderId} as ${nextStatus}`);

                // Update local order
                const updateFields = {
                    order_status: nextStatus,
                    updated_at: new Date().toISOString(),
                    pending_sync: true
                };
                if (nextStatus === 'ready') updateFields.ready_at = new Date().toISOString();

                await db.orders.update(smartOrderId, updateFields);

                // Update local items
                const itemStatusForItems = nextStatus === 'completed' ? 'completed' :
                    nextStatus === 'ready' ? 'ready' : 'in_progress';
                const shouldResetEarlyMarks = ['ready', 'completed', 'shipped'].includes(nextStatus);

                await db.order_items
                    .where('order_id')
                    .equals(smartOrderId)
                    .modify(it => {
                        it.item_status = itemStatusForItems;
                        if (shouldResetEarlyMarks) it.is_early_delivered = false;
                    });

                // ALWAYS queue status updates - they will be synced AFTER the CREATE_ORDER completes
                // For local orders, we store the localOrderId so the sync can match them up
                await queueAction('UPDATE_ORDER_STATUS', {
                    orderId: smartOrderId,
                    localOrderId: isLocalOnly ? smartOrderId : null,
                    newStatus: nextStatus,
                    isLocalOrder: isLocalOnly
                });

                // Send SMS if moving to ready (only if online - SMS requires network)
                // Note: In true offline mode, SMS will fail silently
                if (nextStatus === 'ready' && order?.customerPhone && navigator.onLine) {
                    handleSendSms(orderId, order.customerName, order.customerPhone);
                }

                console.log(`✅ Local update complete for ${smartOrderId} -> ${nextStatus}`);

                // CRITICAL: Don't call fetchOrders() when offline - it might clear the state!
                // Instead, do an optimistic UI update
                if (navigator.onLine) {
                    await fetchOrders();
                } else {
                    // Optimistic local state update
                    console.log('📴 Updating local state optimistically (no fetchOrders)');

                    // Update state directly based on status change
                    if (nextStatus === 'completed') {
                        // Save for undo before removing
                        const orderToRemove = currentOrders.find(o => o.id === orderId || o.originalOrderId === orderId) ||
                            completedOrders.find(o => o.id === orderId || o.originalOrderId === orderId);
                        if (orderToRemove) {
                            setLastAction({
                                type: 'status_change',
                                orderId: orderId,
                                previousStatus: orderToRemove.orderStatus || 'ready',
                                newStatus: 'completed',
                                timestamp: new Date()
                            });
                        }
                        // Remove from both lists
                        setCurrentOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                        setCompletedOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                    } else if (nextStatus === 'ready') {
                        // Move from current to completed
                        const orderToMove = currentOrders.find(o => o.id === orderId || o.originalOrderId === orderId);
                        if (orderToMove) {
                            // Save for undo
                            setLastAction({
                                type: 'status_change',
                                orderId: orderId,
                                previousStatus: orderToMove.orderStatus || 'in_progress',
                                newStatus: 'ready',
                                timestamp: new Date()
                            });
                            setCurrentOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                            setCompletedOrders(prev => {
                                const newOrder = {
                                    ...orderToMove,
                                    id: orderId,
                                    orderStatus: 'ready',
                                    type: 'ready',
                                    ready_at: new Date().toISOString()
                                };
                                const filtered = prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId);
                                // Add to end (newest ready = left side in RTL)
                                return [...filtered, newOrder];
                            });
                        }
                    } else if (nextStatus === 'in_progress') {
                        // Move from completed back to current (undo)
                        const orderToMove = completedOrders.find(o => o.id === orderId || o.originalOrderId === orderId);
                        if (orderToMove) {
                            // Save for potential re-undo
                            setLastAction({
                                type: 'status_change',
                                orderId: orderId,
                                previousStatus: orderToMove.orderStatus || 'ready',
                                newStatus: 'in_progress',
                                timestamp: new Date()
                            });
                            // Remove from completed
                            setCompletedOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                            // Insert at correct position based on created_at
                            setCurrentOrders(prev => {
                                const newOrder = {
                                    ...orderToMove,
                                    id: orderId,
                                    orderStatus: 'in_progress',
                                    type: 'active'
                                };
                                const filtered = prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId);
                                // Find correct position based on created_at (oldest first = right side in RTL)
                                const orderTime = new Date(orderToMove.created_at || 0).getTime();
                                let insertIndex = filtered.length;
                                for (let i = 0; i < filtered.length; i++) {
                                    const existingTime = new Date(filtered[i].created_at || 0).getTime();
                                    if (orderTime < existingTime) {
                                        insertIndex = i;
                                        break;
                                    }
                                }
                                return [...filtered.slice(0, insertIndex), newOrder, ...filtered.slice(insertIndex)];
                            });
                        }
                    } else if (nextStatus === 'new') {
                        // Pending → New (acknowledgment) - just update status in place
                        const orderToUpdate = currentOrders.find(o => o.id === orderId || o.originalOrderId === orderId);
                        if (orderToUpdate) {
                            setLastAction({
                                type: 'status_change',
                                orderId: orderId,
                                previousStatus: orderToUpdate.orderStatus || 'pending',
                                newStatus: 'new',
                                timestamp: new Date()
                            });
                            // Update in place (stays in currentOrders)
                            setCurrentOrders(prev => prev.map(o =>
                                (o.id === orderId || o.originalOrderId === orderId)
                                    ? { ...o, orderStatus: 'new' }
                                    : o
                            ));
                        }
                    }
                    setLastUpdated(new Date());
                }
                return;
            } catch (offlineErr) {
                console.error('❌ Local order update failed:', offlineErr);
                setErrorModal({
                    show: true,
                    title: 'שגיאה בעדכון',
                    message: 'לא הצלחתי לעדכן את ההזמנה מקומית',
                    details: offlineErr.message,
                    retryLabel: 'נסה שוב',
                    onRetry: () => updateOrderStatus(orderId, currentStatus)
                });
                return;
            }
        }

        // 3. ONLINE HANDLING
        try {
            const realOrderId = typeof orderId === 'string' ? orderId.replace(/-stage-\d+/, '').replace('-ready', '') : orderId;
            const smartId = getSmartId(orderId);
            const now = new Date().toISOString();

            // 📸 STEP 1: SNAPSHOT (For Rollback)
            const currentOrdersSnapshot = [...currentOrders];
            const completedOrdersSnapshot = [...completedOrders];

            // 🎯 STEP 2: OPTIMISTIC STATE UPDATE (UI feels instant)
            const orderToMove = currentOrders.find(o => o.id === orderId || o.originalOrderId === orderId) ||
                completedOrders.find(o => o.id === orderId || o.originalOrderId === orderId);

            if (orderToMove) {
                if (nextStatus === 'completed') {
                    setCurrentOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                    setCompletedOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                } else if (nextStatus === 'ready') {
                    log('⬇️ [OPTIMISTIC] Moving to READY');
                    setCurrentOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                    // Insert at correct position based on ready_at to match server order
                    setCompletedOrders(prev => {
                        const optimisticOrder = {
                            ...orderToMove,
                            id: orderId,
                            orderStatus: 'ready',
                            type: 'ready',
                            ready_at: now,
                            items: orderToMove.items?.map(i => ({ ...i, status: 'ready', item_status: 'ready' }))
                        };
                        const filtered = prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId);
                        // Insert at the END (newest ready goes to the left in RTL, which is end of array)
                        const newList = [...filtered, optimisticOrder];
                        log('📊 [OPTIMISTIC] New completedOrders:', newList.map(o => o.id));
                        return newList;
                    });
                } else if (nextStatus === 'in_progress') {
                    log('⬆️ [OPTIMISTIC] Moving to IN_PROGRESS');
                    setCompletedOrders(prev => prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId));
                    // Insert at correct position based on created_at to match server order
                    setCurrentOrders(prev => {
                        const optimisticOrder = {
                            ...orderToMove,
                            id: orderId,
                            orderStatus: 'in_progress',
                            type: 'active',
                            items: orderToMove.items?.map(i => ({ ...i, status: 'in_progress', item_status: 'in_progress' }))
                        };
                        const filtered = prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId);
                        // Find correct position based on created_at (oldest first = right side in RTL)
                        const orderTime = new Date(orderToMove.created_at || 0).getTime();
                        let insertIndex = filtered.length; // Default: end
                        for (let i = 0; i < filtered.length; i++) {
                            const existingTime = new Date(filtered[i].created_at || 0).getTime();
                            if (orderTime < existingTime) {
                                insertIndex = i;
                                break;
                            }
                        }
                        const newList = [...filtered.slice(0, insertIndex), optimisticOrder, ...filtered.slice(insertIndex)];
                        log('📊 [OPTIMISTIC] New currentOrders:', newList.map(o => o.id));
                        return newList;
                    });
                } else if (nextStatus === 'new') {
                    // Pending → New (acknowledgment) - update in place
                    log('📝 [OPTIMISTIC] Acknowledging pending → new');
                    setCurrentOrders(prev => prev.map(o =>
                        (o.id === orderId || o.originalOrderId === orderId)
                            ? { ...o, orderStatus: 'new' }
                            : o
                    ));
                }
                log('✅ [OPTIMISTIC] State updated, triggering setLastUpdated');
                setLastUpdated(new Date());

                // ANTI-JUMP: Block auto-fetches for 3 seconds to let animation complete
                skipFetchUntilRef.current = Date.now() + 3000;
                log('🛡️ [ANTI-JUMP] Blocking auto-fetch until', new Date(skipFetchUntilRef.current).toISOString());
            }

            // 🎯 STEP 3: OPTIMISTIC DEXIE UPDATE (Critical for stable UI during sync)
            const applyDexieUpdate = async () => {
                try {
                    const { db } = await import('../../../db/database');
                    const updateFields = {
                        order_status: nextStatus,
                        updated_at: now,
                        pending_sync: true
                    };
                    if (nextStatus === 'ready') updateFields.ready_at = now;
                    await db.orders.update(smartId, updateFields);

                    const itemStatus = nextStatus === 'completed' ? 'completed' :
                        nextStatus === 'ready' ? 'ready' :
                            nextStatus === 'new' ? 'new' : 'in_progress';

                    const shouldResetEarlyMarks = ['ready', 'completed', 'shipped'].includes(nextStatus);

                    await db.order_items.where('order_id').equals(smartId).modify(it => {
                        it.item_status = itemStatus;
                        if (shouldResetEarlyMarks) it.is_early_delivered = false;
                    });
                } catch (e) {
                    console.warn('Dexie background update failed:', e);
                }
            };
            await applyDexieUpdate();

            // 🌐 STEP 4: SUPABASE UPDATE
            try {
                // Consolidate to use THE ONE TRUE RPC for all whole-card status updates
                // This prevents "Ghost Items" (e.g. Grab & Go items) from being left behind
                // because the RPC handles the item-status state machine on the server.

                const rpcParams = {
                    p_order_id: realOrderId,
                    p_new_status: nextStatus,
                    p_business_id: businessId
                };

                // Specific tweaks for certain transitions
                if (nextStatus === 'new') {
                    rpcParams.p_item_status = 'new';
                } else if (currentStatus === 'undo_ready' || nextStatus === 'in_progress') {
                    rpcParams.p_item_status = 'in_progress';
                } else if (nextStatus === 'ready' || nextStatus === 'completed') {
                    // Note: If p_item_status is NULL, update_order_status_v3 uses its internal
                    // intelligent logic which is perfect for these transitions.
                }

                log('🌐 [SUPABASE] Calling update_order_status_v3', rpcParams);
                const { data: rpcData, error: rpcError } = await supabase.rpc('update_order_status_v3', rpcParams);

                if (rpcError) {
                    console.error('❌ [SUPABASE] RPC Error:', rpcError);
                    throw rpcError;
                }

                if (nextStatus === 'ready' && orderToMove?.customerPhone) {
                    handleSendSms(orderId, orderToMove.customerName, orderToMove.customerPhone);
                }

                log('✅ [SERVER] Supabase update confirmed:', rpcData);

                // ✅ Reset early delivered marks on Supabase if order moved to ready/completed
                if (['ready', 'completed', 'shipped'].includes(nextStatus)) {
                    supabase.from('order_items')
                        .update({ is_early_delivered: false })
                        .eq('order_id', realOrderId)
                        .then(() => log('🧹 [SERVER] Cleared early marks for', realOrderId));
                }

                // Delayed refresh to clear pending_sync flag once server matures
                // Extended to 2 seconds to allow layout animations to settle
                log('⏰ [REFRESH] Scheduling fetchOrders in 2 seconds...');
                setTimeout(() => {
                    log('🔄 [REFRESH] Executing fetchOrders now');
                    fetchOrders();
                }, 2000);

            } catch (supabaseErr) {
                console.error('❌ Supabase update failed, rolling back UI:', supabaseErr);

                // 🔙 ROLLBACK React State
                setCurrentOrders(currentOrdersSnapshot);
                setCompletedOrders(completedOrdersSnapshot);

                // 🔙 ROLLBACK Dexie
                const { db } = await import('../../../db/database');
                await db.orders.update(smartId, { pending_sync: false });

                setErrorModal({
                    show: true,
                    title: 'שגיאה בעדכון',
                    message: 'העדכון נכשל בשרת והוחזר למצבו הקודם',
                    details: supabaseErr.message
                });
            }
        } catch (globalErr) {
            console.error('❌ Global error in updateOrderStatus:', globalErr);
        }
    };

    const handleFireItems = async (orderId, itemsToFire) => {
        try {
            setIsLoading(true);
            const itemIds = itemsToFire.map(i => i.id);

            // FIX: Extract clean UUID if it's a composite ID (e.g. "uuid-delayed")
            // This prevents "invalid input syntax for type uuid" error in RPC
            const cleanOrderId = (typeof orderId === 'string' && orderId.length > 36)
                ? orderId.replace('-delayed', '').replace('-stage-1', '').replace('-stage-2', '')
                : orderId;

            // CHANGED: Use supabase directly
            const { error } = await supabase.rpc('fire_items_v2', {
                p_order_id: cleanOrderId,
                p_item_ids: itemIds
            });

            if (error) throw error;
            await fetchOrders();
        } catch (err) {
            console.error('Error firing items:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה בהפעלת פריטים',
                message: 'לא הצלחנו לעדכן את סטטוס הפריטים',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleFireItems(orderId, itemsToFire)
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleReadyItems = async (orderId, itemsToReady) => {
        try {
            setIsLoading(true);
            const itemIds = itemsToReady.map(i => i.id);

            // CHANGED: Use supabase directly
            const { error } = await supabase.rpc('mark_items_ready_v2', {
                p_order_id: orderId,
                p_item_ids: itemIds
            });

            if (error) throw error;
            await fetchOrders();
        } catch (err) {
            console.error('Error marking items ready:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה בהעברה למוכן',
                message: 'לא הצלחנו לעדכן את סטטוס הפריטים',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleReadyItems(orderId, itemsToReady)
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleEarlyDelivered = async (orderId, itemId, currentValue) => {
        try {
            const newValue = !currentValue;
            log(`🔄 [TOGGLE-EARLY] Item ${itemId}: ${currentValue} -> ${newValue}`);

            // 1. Optimistic UI update
            const updateItemInList = (list) => list.map(order => ({
                ...order,
                items: order.items?.map(item => {
                    const ids = item.ids || [item.id];
                    if (ids.includes(itemId)) {
                        return { ...item, is_early_delivered: newValue };
                    }
                    return item;
                })
            }));

            setCurrentOrders(prev => updateItemInList(prev));

            // 2. Supabase Update
            const { error } = await supabase.rpc('toggle_early_delivered', {
                p_item_id: itemId,
                p_value: newValue
            });

            if (error) {
                // Revert state on error
                const revertItemInList = (list) => list.map(order => ({
                    ...order,
                    items: order.items?.map(item => {
                        const ids = item.ids || [item.id];
                        if (ids.includes(itemId)) {
                            return { ...item, is_early_delivered: currentValue };
                        }
                        return item;
                    })
                }));
                setCurrentOrders(prev => revertItemInList(prev));
                throw error;
            }

            // 3. Dexie Update
            await db.order_items.update(itemId, { is_early_delivered: newValue });

            log('✅ [TOGGLE-EARLY] Success');
            return true;
        } catch (err) {
            console.error('❌ [TOGGLE-EARLY] Error:', err);
            return false;
        }
    };

    const handleUndoLastAction = async () => {
        if (!lastAction) return;
        setIsLoading(true);
        try {
            // Targeted Undo using specific Item IDs
            if (lastAction.itemIds && lastAction.itemIds.length > 0) {
                console.log('↺ Targeted Undo:', lastAction);

                if (lastAction.previousStatus === 'ready') {
                    // Revert from Completed -> Ready
                    // Retrieve realOrderId from stored orderId (which implies stripping suffix if present, though lastAction.orderId should be clean usually)
                    // But safe to clean again just in case
                    const realOrderId = typeof lastAction.orderId === 'string'
                        ? lastAction.orderId.replace(/-stage-\d+/, '').replace('-ready', '')
                        : lastAction.orderId;

                    // Determine keep_open. If returning to READY, usually keeps open if not fully fully archived. 
                    // Let's assume false or calculate? Since we can't easily calculating from here without full state, 
                    // Let's use false because Ready usually means "Done with kitchen".
                    // HOWEVER, if we have other active items, we might need true.
                    // Ideally we should know. But complete_order_part_v2 is forgiving.
                    const { error } = await supabase.rpc('complete_order_part_v2', {
                        p_order_id: String(realOrderId).trim(),
                        p_item_ids: lastAction.itemIds,
                        p_keep_order_open: true // Must keep open to show in Ready section
                    });
                    if (error) throw error;
                } else if (lastAction.previousStatus === 'in_progress') {
                    // Revert from Ready -> In Progress
                    const { error } = await supabase.rpc('fire_items_v2', {
                        p_order_id: lastAction.orderId,
                        p_item_ids: lastAction.itemIds
                    });
                    if (error) throw error;
                } else {
                    // Fallback for other statuses
                    const { error } = await supabase.rpc('update_order_status', {
                        p_order_id: lastAction.orderId,
                        p_status: lastAction.previousStatus
                    });
                    if (error) throw error;
                }
            } else {
                // Legacy / Fallback for whole order undo
                console.warn('⚠️ Legacy Undo (Whole Order) for:', lastAction.orderId);
                const { error } = await supabase.rpc('update_order_status', {
                    p_order_id: lastAction.orderId,
                    p_status: lastAction.previousStatus
                });
                if (error) throw error;
            }

            setLastAction(null);
            await fetchOrders();
        } catch (err) {
            console.error('Failed to undo:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmPayment = async (orderId, paymentMethod = 'cash') => {
        // Clean orderId - remove KDS suffixes like "-ready" or "-stage-2"
        let cleanOrderId = orderId;
        if (typeof orderId === 'string') {
            if (orderId.endsWith('-ready')) {
                cleanOrderId = orderId.replace(/-ready$/, '');
            }
            cleanOrderId = cleanOrderId.replace(/-stage-\d+$/, '');
        }

        // OFFLINE HANDLING: Update locally and queue for sync
        if (!navigator.onLine) {
            console.log('📴 Offline: Confirming payment locally');
            try {
                const { db } = await import('../../../db/database');
                const { queueAction } = await import('../../../services/offlineQueue');

                // Update local order
                await db.orders.update(cleanOrderId, {
                    is_paid: true,
                    payment_method: paymentMethod,
                    updated_at: new Date().toISOString()
                });

                // Queue for later sync
                await queueAction('CONFIRM_PAYMENT', {
                    orderId: cleanOrderId,
                    paymentMethod: paymentMethod
                });

                console.log(`✅ Payment confirmed locally: ${cleanOrderId} (${paymentMethod})`);

                await fetchOrders();
                return;
            } catch (offlineErr) {
                console.error('❌ Offline payment confirmation failed:', offlineErr);
                setErrorModal({
                    show: true,
                    title: 'שגיאה באישור תשלום',
                    message: 'לא הצלחתי לעדכן את התשלום מקומית',
                    details: offlineErr.message,
                    retryLabel: 'נסה שוב',
                    onRetry: () => handleConfirmPayment(orderId, paymentMethod)
                });
                throw offlineErr;
            }
        }

        try {
            // Use RPC function to bypass RLS - now also passing payment_method
            const { data, error } = await supabase.rpc('confirm_order_payment', {
                p_order_id: cleanOrderId,
                p_payment_method: paymentMethod
            });

            if (error) throw error;

            // 🆕 Show Success Toast
            setSmsToast({ message: 'התשלום עודכן בהצלחה!', isError: false });
            setTimeout(() => setSmsToast(null), 3000);

            await fetchOrders();
        } catch (err) {
            console.error('❌ Error confirming payment:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה באישור תשלום',
                message: 'לא הצלחנו לעדכן את התשלום במערכת',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleConfirmPayment(orderId, paymentMethod)
            });
            throw err;
        }
    };

    const handleCancelOrder = async (orderId) => {
        try {
            // Clean orderId - remove KDS suffixes
            let cleanOrderId = orderId;
            if (typeof orderId === 'string') {
                if (orderId.endsWith('-ready')) {
                    cleanOrderId = orderId.replace(/-ready$/, '');
                }
                cleanOrderId = cleanOrderId.replace(/-stage-\d+$/, '');
            }
            console.log('🗑️ Cancelling order:', cleanOrderId, '(original:', orderId, ')');

            // Mark order as cancelled
            const { error } = await supabase
                .from('orders')
                .update({ order_status: 'cancelled' })
                .eq('id', cleanOrderId);

            if (error) throw error;

            // Also cancel all order items
            await supabase
                .from('order_items')
                .update({ item_status: 'cancelled' })
                .eq('order_id', cleanOrderId);

            await fetchOrders();
        } catch (err) {
            console.error('Error cancelling order:', err);
            setErrorModal({
                show: true,
                title: 'שגיאה בביטול הזמנה',
                message: 'לא הצלחנו לבטל את ההזמנה',
                details: err.message,
                retryLabel: 'נסה שוב',
                onRetry: () => handleCancelOrder(orderId)
            });
        }
    };

    const realtimeDebounceTimer = useRef(null);

    // Polling (Every 10 seconds - less aggressive for production)
    useEffect(() => {
        const controller = new AbortController();
        let isInitialFetch = true;

        const runFetch = () => {
            // ANTI-JUMP: Skip fetch if we're in the "cooldown" window after a manual status update
            // BUT always allow the initial fetch
            if (!isInitialFetch && Date.now() < skipFetchUntilRef.current) {
                log('⏳ [POLL] Skipping - in anti-jump cooldown');
                return;
            }
            isInitialFetch = false;
            if (navigator.onLine) {
                fetchOrders(controller.signal);
            }
        };

        runFetch(); // Initial fetch (bypasses cooldown)

        const interval = setInterval(runFetch, 10000);

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [fetchOrders, currentUser]); // ✅ Runs on mount AND when fetchOrders/auth changes

    // Realtime
    useEffect(() => {
        if (!currentUser) return;

        const schema = 'public';
        const businessId = currentUser?.business_id;

        log(`🔌 Connecting to Realtime on schema: ${schema}, business: ${businessId}`);

        // Helper to create filter string
        const filter = businessId ? `business_id=eq.${businessId}` : undefined;

        const debouncedFetch = (payload) => {
            // CRITICAL: Don't fetch on realtime events if offline
            if (!navigator.onLine) {
                log('📴 [REALTIME] Ignoring event - device is offline');
                return;
            }

            // 🎯 NEW: Maya's Fast-Sync - Update state directly if it's an UPDATE event
            if (payload?.eventType === 'UPDATE' && payload.new) {
                const updatedOrder = payload.new;
                const newStatus = updatedOrder.order_status;
                const orderId = updatedOrder.id;

                log(`⚡ [REALTIME-FAST] Direct state update for ${orderId.slice(0, 8)} to ${newStatus}`);

                // 1. If moving to READY: Remove from current, add to completed
                if (newStatus === 'ready') {
                    setCurrentOrders(prev => {
                        const order = prev.find(o => o.id === orderId || o.originalOrderId === orderId);
                        if (order) {
                            // Optimistically move to completed
                            setCompletedOrders(comp => [...comp, { ...order, orderStatus: 'ready', ready_at: updatedOrder.ready_at }]);
                            return prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId);
                        }
                        return prev;
                    });
                }
                // 2. If moving to IN_PROGRESS/NEW: Remove from completed, add to current
                else if (['new', 'in_progress', 'pending'].includes(newStatus)) {
                    setCompletedOrders(prev => {
                        const order = prev.find(o => o.id === orderId || o.originalOrderId === orderId);
                        if (order) {
                            // Optimistically move to active
                            setCurrentOrders(curr => [...curr, { ...order, orderStatus: newStatus }]);
                            return prev.filter(o => o.id !== orderId && o.originalOrderId !== orderId);
                        }
                        return prev;
                    });

                    // Also update in place if already in current
                    setCurrentOrders(prev => prev.map(o =>
                        (o.id === orderId || o.originalOrderId === orderId) ? { ...o, orderStatus: newStatus } : o
                    ));
                }
            }

            // Still trigger a debounced full fetch to ensure Dexie and items are synced
            if (Date.now() < skipFetchUntilRef.current) {
                log('⏳ [REALTIME] Skipping full fetch - in anti-jump cooldown');
                return;
            }
            if (realtimeDebounceTimer.current) clearTimeout(realtimeDebounceTimer.current);
            realtimeDebounceTimer.current = setTimeout(() => {
                if (!navigator.onLine || Date.now() < skipFetchUntilRef.current) return;
                log('🔄 [REALTIME] Executing debounced full fetchOrders');
                fetchOrders();
                realtimeDebounceTimer.current = null;
            }, 500);
        };

        const channel = supabase
            .channel(`kds-status-${businessId}`) // Unique channel name
            .on('postgres_changes', {
                event: '*',
                schema: schema,
                table: 'orders',
                filter: filter
            }, (payload) => {
                log('🔔 Realtime update received (orders):', payload.eventType);
                debouncedFetch(payload);
            })
            .on('postgres_changes', {
                event: '*',
                schema: schema,
                table: 'order_items'
            }, (payload) => {
                log('🔔 Realtime update received (order_items):', payload.eventType);
                debouncedFetch(payload);
            })
            .subscribe((status) => {
                log('🔌 Realtime subscription status:', status);
            });

        return () => {
            if (realtimeDebounceTimer.current) clearTimeout(realtimeDebounceTimer.current);
            supabase.removeChannel(channel);
        };
    }, [currentUser, fetchOrders]);

    // Heartbeat for System Health (Super Admin Stats)
    useEffect(() => {
        if (!currentUser?.business_id) return;

        // Generate or retrieve device ID
        let deviceId = localStorage.getItem('kds_device_id');
        if (!deviceId) {
            deviceId = 'kds_' + uuidv4();
            localStorage.setItem('kds_device_id', deviceId);
        }

        // Get public IP - fetch once at start, then use cached
        const fetchIp = async () => {
            // OFFLINE GUARD: Don't try to fetch IP if offline
            if (!navigator.onLine) return null;

            const cached = sessionStorage.getItem('device_public_ip');
            if (cached) return cached;
            try {
                // Try multiple IP services in case one fails
                const services = [
                    'https://api.ipify.org?format=json',
                    'https://api.my-ip.io/ip.json'
                ];
                for (const url of services) {
                    try {
                        const res = await fetch(url, { timeout: 5000 });
                        const data = await res.json();
                        const ip = data.ip || data.success?.ip;
                        if (ip) {
                            sessionStorage.setItem('device_public_ip', ip);
                            console.log('🌐 Got IP:', ip);
                            return ip;
                        }
                    } catch { /* try next */ }
                }
                return null;
            } catch {
                return null;
            }
        };

        const sendHeartbeat = async () => {
            // OFFLINE GUARD: Don't send heartbeat if offline
            if (!navigator.onLine) {
                console.log('📴 Skipping heartbeat - device is offline');
                return;
            }
            try {
                const ip = await fetchIp();
                const screenRes = `${window.screen.width}x${window.screen.height}`;
                const payload = {
                    p_business_id: currentUser.business_id,
                    p_device_id: deviceId,
                    p_device_type: 'kds',
                    p_ip_address: ip || 'לא זמין',
                    p_user_agent: navigator.userAgent?.substring(0, 200) || 'Unknown',
                    p_screen_resolution: screenRes,
                    p_user_name: currentUser.name || currentUser.employee_name || 'אורח',
                    p_employee_id: currentUser.id || null
                };
                console.log('💓 Sending heartbeat:', { deviceId, ip, screenRes, user: payload.p_user_name });
                const { data, error } = await supabase.rpc('send_device_heartbeat', payload);
                if (error) {
                    console.error('❌ Heartbeat error:', error);
                    throw error;
                }
                console.log('✅ Heartbeat success');
            } catch (err) {
                console.warn('⚠️ Device heartbeat failed:', err.message);
                // Fallback to old heartbeat only if still online
                if (navigator.onLine) {
                    try {
                        await supabase.rpc('send_kds_heartbeat', {
                            p_business_id: currentUser.business_id
                        });
                    } catch (e) {
                        console.error('❌ All heartbeats failed');
                    }
                }
            }
        };

        // Fetch IP first, then start heartbeat cycle
        fetchIp().then(() => {
            sendHeartbeat(); // Initial call after IP is fetched
        });

        const interval = setInterval(sendHeartbeat, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [currentUser]);

    const fetchHistoryOrders = useCallback(async (date, signal) => {
        try {
            setIsLoading(true);
            const businessId = currentUser?.business_id;

            // OFFLINE FALLBACK: Load from Dexie
            if (!navigator.onLine) {
                console.log('📴 Offline: Loading history from Dexie');
                try {
                    const { db } = await import('../../../db/database');

                    // Get completed orders from local DB
                    const startOfDay = new Date(date);
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date(date);
                    endOfDay.setHours(23, 59, 59, 999);

                    const localOrders = await db.orders
                        .filter(o => {
                            const created = new Date(o.created_at);
                            // Only show truly finished orders in history: either paid completed OR cancelled
                            const isTrulyFinished = (o.order_status === 'completed' && o.is_paid === true) || o.order_status === 'cancelled';

                            return created >= startOfDay && created <= endOfDay &&
                                isTrulyFinished &&
                                o.business_id === businessId;
                        })
                        .toArray();

                    // Get order items
                    const orderIds = localOrders.map(o => o.id);
                    const allItems = await db.order_items.toArray();
                    const menuItems = await db.menu_items.toArray();
                    const menuMap = new Map(menuItems.map(m => [m.id, m]));

                    const processedOrders = localOrders.map(order => {
                        const items = allItems.filter(i => orderIds.includes(i.order_id) && i.order_id === order.id);
                        return {
                            id: order.id,
                            orderNumber: order.order_number,
                            customerName: order.customer_name || 'אורח',
                            customerPhone: order.customer_phone,
                            isPaid: order.is_paid,
                            total: order.total_amount,
                            createdAt: order.created_at,
                            items: items.map(item => {
                                const menu = menuMap.get(item.menu_item_id) || { name: 'פריט', price: 0 };
                                return {
                                    id: item.id,
                                    name: menu.name,
                                    quantity: item.quantity,
                                    price: item.price || menu.price,
                                    status: item.item_status
                                };
                            })
                        };
                    });

                    console.log(`📴 Loaded ${processedOrders.length} history orders from Dexie`);
                    return processedOrders;
                } catch (dexieErr) {
                    console.error('Dexie history load failed:', dexieErr);
                    return [];
                } finally {
                    setIsLoading(false);
                }
            }

            // 1. Fetch Option Map
            const { data: allOptionValues } = await supabase
                .from('optionvalues')
                .select('id, value_name')
                .abortSignal(signal); // Pass signal

            const optionMap = new Map();
            allOptionValues?.forEach(ov => {
                optionMap.set(String(ov.id), ov.value_name);
                optionMap.set(ov.id, ov.value_name);
            });

            // 2. Date Range (Local Day)
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            console.log('📜 Fetching history for:', startOfDay.toLocaleString());
            let historyData = [];
            let usedRpc = false;

            // 1. Try RPC V2 (Preferred)
            // 1. Try RPC V3 (Fixed for items/payment)
            // FIX: Use local date components instead of ISOString to avoid jumping back a day in non-UTC timezones
            const dateStr = `${startOfDay.getFullYear()}-${String(startOfDay.getMonth() + 1).padStart(2, '0')}-${String(startOfDay.getDate()).padStart(2, '0')}`;

            const { data: v2Data, error: v2Error } = await supabase
                .rpc('get_kds_history_orders_v3', {
                    p_date: dateStr,
                    p_business_id: currentUser?.business_id, // Pass business_id for security
                    p_limit: 500,
                    p_offset: 0
                })
                .abortSignal(signal);

            if (!v2Error && v2Data && v2Data.length > 0) {
                console.log(`📜 [HISTORY RPC] Fetched ${v2Data.length} raw orders from V3 for date: ${dateStr}`);

                // Simplified Filter for History: Show everything that is paid, completed, OR cancelled.
                // If the user is in the history tab, they want to see all closed/settled orders.
                historyData = v2Data.filter(o => {
                    const isCancelled = o.order_status === 'cancelled';
                    const isPaid = o.is_paid || o.isPaid || (Number(o.paid_amount) > 0) || (o.payment_method && o.payment_method !== 'null');
                    const isCompleted = o.order_status === 'completed' || o.order_status === 'ready';

                    // 🛑 CRITICAL: Explicitly EXCLUDE orders that are still being worked on
                    const isInProgress = o.order_status === 'in_progress' || o.order_status === 'new';

                    // Rule: If it reached a final state (Paid, Completed, or Cancelled) AND NOT in progress.
                    if (isPaid || isCompleted || isCancelled) {
                        return !isInProgress;
                    }

                    return false; // Orders not settled do not belong in history
                });

                usedRpc = true;
            } else {
                if (v2Error && v2Error.name !== 'AbortError') {
                    console.warn('⚠️ RPC V2/V3 failed or empty, trying V1...', v2Error?.message);
                }

                // If it wasn't an abort, and V3 was empty or failed, try V1
                if (!signal?.aborted) {
                    console.log('🔄 RPC V3 was empty/failed. Falling back to RPC V1...');
                    const { data: v1Data, error: v1Error } = await supabase
                        .rpc('get_kds_history_orders', {
                            p_start_date: startOfDay.toISOString(),
                            p_end_date: endOfDay.toISOString(),
                            p_business_id: businessId || null
                        })
                        .limit(500)
                        .abortSignal(signal);

                    if (!v1Error && v1Data) {
                        console.log(`📜 [HISTORY RPC] Fetched ${v1Data.length} raw orders from V1`);
                        historyData = v1Data.filter(o => {
                            const isCancelled = o.order_status === 'cancelled';
                            const isRefunded = o.is_refund || o.isRefund || (o.refund_amount > 0);
                            const isPaid = o.is_paid || o.isPaid;
                            const isCompleted = o.order_status === 'completed';

                            if (isPaid || isCompleted) return true;
                            if (isCancelled) return isRefunded;
                            return true;
                        });
                        usedRpc = true;
                    }
                }
            }

            // NORMALIZE: Ensure order_items is a valid array
            historyData = (historyData || []).map(o => ({
                ...o,
                order_items: o.order_items || o.items_detail || []
            }));

            // 3. Process Items (Normalize Structure and Parse Mods)
            const processedHistory = (historyData || []).map(order => {
                try {
                    const items = (order.order_items || [])
                        .map(item => {
                            let modsArray = [];
                            if (item.mods) {
                                try {
                                    const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                                    if (Array.isArray(parsed)) {
                                        modsArray = parsed.map(m => {
                                            if (typeof m === 'object' && m?.value_name) return m.value_name;
                                            return String(m);
                                        }).filter(m => m && !m.toLowerCase().includes('default') && m !== 'רגיל' && !String(m).includes('KDS_OVERRIDE'));
                                    } else if (typeof parsed === 'object' && parsed !== null) {
                                        // Handle object-style mods if they exist
                                        modsArray = Object.values(parsed).map(v => typeof v === 'object' ? v.value_name : String(v)).filter(Boolean);
                                    }
                                } catch (e) { /* ignore */ }
                            }

                            if (item.notes) {
                                modsArray.push({ name: item.notes, is_note: true });
                            }

                            // Construct Modifiers for React (Safe Colors)
                            const structuredModifiers = modsArray.map(mod => {
                                if (typeof mod === 'object' && mod.is_note) {
                                    return { text: mod.name, color: 'mod-color-purple', isNote: true };
                                }
                                const modName = typeof mod === 'string' ? mod : (mod.name || String(mod));
                                let color = 'mod-color-gray';
                                if (modName.includes('סויה')) color = 'mod-color-lightgreen';
                                else if (modName.includes('שיבולת')) color = 'mod-color-beige';
                                else if (modName.includes('שקדים')) color = 'mod-color-lightyellow';
                                else if (modName.includes('נטול')) color = 'mod-color-blue';
                                else if (modName.includes('רותח')) color = 'mod-color-red';
                                else if (modName.includes('קצף') && !modName.includes('בלי')) color = 'mod-color-foam-up';
                                else if (modName.includes('בלי קצף')) color = 'mod-color-foam-none';
                                return { text: modName, color: color, isNote: false };
                            });

                            const itemName = item.menu_items?.name || item.name || 'פריט';
                            const itemPrice = item.menu_items?.price || item.price || 0;
                            const category = item.menu_items?.category || '';
                            const modsKey = (modsArray || []).map(m => typeof m === 'object' ? m.name : m).sort().join('|');

                            return {
                                id: item.id || Math.random().toString(),
                                menuItemId: item.menu_items?.id || item.menu_item_id,
                                name: itemName,
                                modifiers: structuredModifiers,
                                quantity: item.quantity || 1,
                                status: item.item_status || 'completed',
                                price: itemPrice,
                                category: category,
                                modsKey: modsKey,
                                course_stage: item.course_stage || 1,
                                item_fired_at: item.item_fired_at || order.created_at,
                                is_early_delivered: item.is_early_delivered || false
                            };
                        });

                    // Group similar items for cleaner display
                    const groupedItems = groupOrderItems(items);

                    // Robust check for paid status from various possible field names
                    const isPaid = order.is_paid || order.isPaid || (Number(order.paid_amount) > 0);
                    const orderStatus = order.order_status || order.status || 'unknown';

                    // Ensure date is valid back-up
                    const orderDate = order.created_at ? new Date(order.created_at) : new Date();
                    const safeDate = isNaN(orderDate.getTime()) ? new Date() : orderDate;

                    if (String(order.order_number).includes('1790') || String(order.id).includes('d264b6c9')) {
                        console.log(`🎯 [HISTORY-PROCESS] Order ${order.order_number}:`, {
                            isPaid,
                            orderStatus,
                            itemsCount: items.length,
                            paymentMethod: order.payment_method
                        });
                    }

                    const refundAmt = Number(order.refund_amount) || 0;

                    return {
                        id: order.id || Math.random().toString(),
                        orderNumber: order.order_number || `#${String(order.id).slice(0, 8)}`,
                        customerName: order.customer_name || 'אורח',
                        customerPhone: order.customer_phone || '',
                        isPaid: !!isPaid,
                        totalAmount: order.total_amount || 0,
                        paidAmount: order.paid_amount || 0,
                        fullTotalAmount: order.total_amount || 0,
                        is_refund: order.is_refund || (refundAmt > 0),
                        refund_amount: refundAmt,
                        refund_method: order.refund_method || order.payment_method,
                        totalOriginalAmount: (Number(order.total_amount) || 0) + refundAmt,
                        timestamp: safeDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                        created_at: order.created_at || new Date().toISOString(),
                        fired_at: order.fired_at,
                        ready_at: order.ready_at,
                        updated_at: order.updated_at,
                        orderStatus: orderStatus,
                        items: groupedItems,
                        type: 'history',
                        status: orderStatus,
                        payment_method: order.payment_method || 'cash',
                        business_id: order.business_id,
                        notes: order.notes || ''
                    };
                } catch (cardErr) {
                    console.error('Critical failure processing card in history:', cardErr, order);
                    return null; // Group cleanup will remove this
                }
            }).filter(Boolean);

            // LOG 2: Separation Check
            const ourOrder = processedHistory.find(o =>
                String(o.id).includes('d264b6c9') ||
                String(o.orderNumber).includes('1790')
            );

            if (ourOrder) {
                console.log(`📌 [SEPARATION] Our order:`, {
                    id: ourOrder.id,
                    orderNumber: ourOrder.orderNumber,
                    type: ourOrder.type,
                    orderStatus: ourOrder.orderStatus,
                    willGoTo: (ourOrder.type === 'active' || ourOrder.type === 'delayed') ? 'CURRENT 🟢' : 'COMPLETED 🔴'
                });
            }

            // A. Current / Active Orders
            // Filter out completed/cancelled unless they are delayed/active typed
            const current = processedHistory.filter(o =>
                o.type === 'active' ||
                o.type === 'delayed' ||
                (o.orderStatus !== 'completed' && o.orderStatus !== 'cancelled')
            ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            // B. Completed / Ready Orders
            // Show ONLY ready or completed
            // B. Completed / Ready Orders
            // Sort: Paid First (Left), Unpaid Last (Right).
            // Secondary Sort: Oldest First (Left), Newest Last (Right).
            // Result in flex-row-reverse RTL: left [Oldest Paid ... Newest Paid ... Oldest Unpaid ... Newest Unpaid] right
            const completed = processedHistory.filter(o => o.type === 'ready' || o.orderStatus === 'ready' || o.orderStatus === 'completed').sort((a, b) => {
                // 1. Priority: Unpaid comes LAST (1) so it is at the end (Right side)
                if (a.isPaid !== b.isPaid) {
                    return a.isPaid ? -1 : 1; // Paid (-1) comes before Unpaid (1)
                }

                // 2. Priority: Newest time comes LAST (Right side)
                const timeA = new Date(a.ready_at || a.updated_at || a.created_at).getTime();
                const timeB = new Date(b.ready_at || b.updated_at || b.created_at).getTime();

                return timeA - timeB; // Ascending Sort (Oldest -> Newest)
            });

            // LOG 3: Final Lists
            console.log(`📊 [FINAL] Lists:`, {
                currentCount: current.length,
                completedCount: completed.length,
                ourOrderInCurrent: current.some(o => String(o.orderNumber).includes('1790')),
                ourOrderInCompleted: completed.some(o => String(o.orderNumber).includes('1790'))
            });

            return processedHistory;

        } finally {
            setIsLoading(false);
        }
    }, [currentUser?.business_id]);

    const findNearestActiveDate = useCallback(async (fromDate) => {
        try {
            const businessId = currentUser?.business_id;
            if (!businessId) return null;

            // Start of the day we're looking before
            const startOfFromDate = new Date(fromDate);
            startOfFromDate.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from('orders')
                .select('created_at')
                .eq('business_id', businessId)
                .lt('created_at', startOfFromDate.toISOString())
                .eq('order_status', 'completed') // חיפוש רק של הזמנות שהושלמו (היסטוריה)
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;
            if (data && data.length > 0) {
                return new Date(data[0].created_at);
            }
            return null;
        } catch (err) {
            console.error('Error finding nearest active date:', err);
            return null;
        }
    }, [currentUser?.business_id]);

    // Force refresh - bypasses anti-jump cooldown for intentional refreshes
    const forceRefresh = useCallback(() => {
        skipFetchUntilRef.current = 0; // Reset cooldown
        fetchOrders();
    }, [fetchOrders]);

    return {
        currentOrders,
        completedOrders,
        isLoading,
        lastUpdated,
        lastAction,
        smsToast,
        setSmsToast,
        errorModal,
        setErrorModal,
        isSendingSms,
        fetchOrders,
        forceRefresh, // Bypasses anti-jump cooldown
        fetchHistoryOrders,
        findNearestActiveDate, // Exported
        updateOrderStatus,
        handleFireItems,
        handleReadyItems,
        handleToggleEarlyDelivered,
        handleUndoLastAction,
        handleConfirmPayment,
        handleCancelOrder,
        handleSendSms
    };
};
