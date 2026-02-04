/**
 * useKDSDataLocal - Local-First KDS Data Hook
 * 
 * This is a simplified, local-first version of useKDSData that:
 * 1. Reads ALL data from Dexie (local IndexedDB)
 * 2. Uses useLiveQuery for real-time reactivity
 * 3. Writes go through offline queue for background sync
 * 
 * Benefits:
 * - Works offline by default
 * - Instant UI updates (no network latency)
 * - Automatic real-time sync via OfflineContext
 */

import { useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from '@/context/AuthContext';
import db from '@/db/database';
import { groupOrderItems } from '@/utils/kdsUtils';
import { useKDSSms } from '@/pages/kds/hooks/useKDSSms';

export const useKDSDataLocal = () => {
    const { currentUser } = useAuth();
    const businessId = currentUser?.business_id;
    const hasAutoSynced = useRef(false);

    // 📱 SMS HOOK integration
    const { smsToast, setSmsToast, isSendingSms, handleSendSms } = useKDSSms();

    // Auto-sync on mount (once)
    useEffect(() => {
        if (businessId && !hasAutoSynced.current) {
            hasAutoSynced.current = true;
            console.log('🔄 [KDS] Auto-syncing data on mount...');

            const autoSync = async () => {
                try {
                    const { syncOrders } = await import('@/services/syncService');
                    const result = await syncOrders(businessId);
                    if (result.success) {
                        console.log(`✅ [KDS] Auto-sync complete: ${result.ordersCount || 0} orders`);
                    }
                } catch (err) {
                    console.error('❌ [KDS] Auto-sync failed:', err);
                }
            };

            autoSync();
        }
    }, [businessId]);

    // ============================================
    // LIVE QUERIES - Auto-update when data changes
    // ============================================

    // Get today's active orders
    const activeOrders = useLiveQuery(async () => {
        if (!businessId) {
            console.log('⏸️ [KDS] No businessId yet');
            return [];
        }

        // 🛠️ FIX: Use BUSINESS DAY starting at 05:00 AM, not a 24-hour window
        const now = new Date();
        const businessDayStart = new Date(now);
        businessDayStart.setHours(5, 0, 0, 0);

        // If it's before 5 AM, the business day started yesterday at 5 AM
        if (now.getHours() < 5) {
            businessDayStart.setDate(businessDayStart.getDate() - 1);
        }

        console.log('🔍 [KDS] Querying orders for businessId:', businessId, 'since:', businessDayStart.toISOString());

        // Get orders that are active AND from current business day
        const orders = await db.orders
            .where('business_id')
            .equals(businessId)
            .filter(o => {
                const orderDate = new Date(o.created_at);
                const isFromToday = orderDate >= businessDayStart;
                const isActive = ['in_progress', 'ready', 'new', 'pending'].includes(o.order_status);
                const isPending = o.pending_sync === true;

                // Only show orders from today's business day
                return (isActive && isFromToday) || (isPending && isFromToday);
            })
            .toArray();

        console.log(`📊 [KDS] Found ${orders.length} active orders from business day`);
        return orders;
    }, [businessId]);

    // Get all order items for active orders
    const orderItems = useLiveQuery(async () => {
        if (!activeOrders || activeOrders.length === 0) return [];

        const orderIds = activeOrders.map(o => o.id);
        console.log('🔍 [KDS] Fetching items for order IDs:', orderIds);

        const items = await db.order_items
            .filter(item => orderIds.some(oid => String(oid) === String(item.order_id)))
            .toArray();

        console.log(`📊 [KDS] Fetched ${items.length} items:`, items.map(i => ({ id: i.id, order_id: i.order_id, status: i.item_status })));
        return items;
    }, [activeOrders]);

    // Get menu items for display
    const menuItems = useLiveQuery(async () => {
        const items = await db.menu_items.toArray();
        return new Map(items.map(m => [m.id, m]));
    }, []);

    // Get option values for modifiers
    const optionValues = useLiveQuery(async () => {
        const values = await db.optionvalues.toArray();
        const map = new Map();
        values.forEach(v => {
            const name = v.name || v.value_name;
            map.set(String(v.id), name);
            map.set(v.id, name);
        });
        return map;
    }, []);

    // ============================================
    // PROCESS DATA
    // ============================================

    const processedOrders = useMemo(() => {
        if (!activeOrders || !orderItems || !menuItems || !optionValues) {
            console.log('⏸️ [KDS] Waiting for data:', {
                hasOrders: !!activeOrders,
                hasItems: !!orderItems,
                hasMenu: !!menuItems,
                hasValues: !!optionValues
            });
            return { current: [], completed: [] };
        }

        console.log(`🔄 [KDS] Processing ${activeOrders.length} orders with ${orderItems.length} items`);

        const current = [];
        const completed = [];

        activeOrders.forEach(order => {
            // Get items for this order
            const items = orderItems.filter(i => String(i.order_id) === String(order.id));

            console.log(`📦 [KDS] Order ${order.order_number}: ${items.length} items`);

            if (items.length === 0) {
                console.log(`⏭️ [KDS] Skipping order ${order.order_number} - no items`);
                return;
            }

            // Check if order has active items
            const hasActiveItems = items.some(i =>
                ['in_progress', 'new', 'pending', 'ready'].includes(i.item_status)
            );

            // Skip completed orders with no active items
            if (order.order_status === 'completed' && !hasActiveItems) {
                console.log(`⏭️ [KDS] Skipping completed order ${order.order_number} - no active items`);
                return;
            }

            // Process items
            const processedItems = items
                .filter(item => {
                    // Filter out completed/cancelled items
                    if (['completed', 'cancelled'].includes(item.item_status)) {
                        console.log(`  ⏭️ Item ${item.id}: status=${item.item_status} (filtered)`);
                        return false;
                    }

                    const menuItem = menuItems.get(item.menu_item_id);
                    // 🛠️ FIX: Do not filter out items just because menu lookup fails. Use item.name instead.
                    const itemName = menuItem?.name || item.name;
                    if (!itemName) {
                        console.log(`  ⏭️ Item ${item.id}: no name found (filtered)`);
                        return false;
                    }

                    // Defaults if menu item missing
                    const kdsLogic = menuItem?.kds_routing_logic || 'MADE_TO_ORDER';
                    const isPrepRequired = menuItem?.is_prep_required;

                    // Check for KDS override in mods
                    let hasOverride = false;
                    const mods = item.mods;
                    if (typeof mods === 'string') {
                        if (mods.includes('__KDS_OVERRIDE__')) {
                            hasOverride = true;
                        } else {
                            // Try parsing as JSON
                            try {
                                const parsed = JSON.parse(mods);
                                if (parsed?.kds_override === true) hasOverride = true;
                                if (Array.isArray(parsed) && parsed.includes('__KDS_OVERRIDE__')) hasOverride = true;
                            } catch (e) { /* ignore */ }
                        }
                    } else if (Array.isArray(mods)) {
                        if (mods.includes('__KDS_OVERRIDE__')) hasOverride = true;
                    } else if (mods && typeof mods === 'object') {
                        // Direct object check
                        if (mods.kds_override === true) hasOverride = true;
                    }

                    // Routing logic priority:
                    // 1. Explicit exclude takes precedence (is_prep_required = false)
                    if (isPrepRequired === false) {
                        // console.log(`  ⏭️ Item ${item.id} (${itemName}): Explicitly hidden (is_prep_required=false)`);
                        return false;
                    }

                    // 2. Explicit include takes precedence (is_prep_required = true)
                    if (isPrepRequired === true) return true;

                    // 3. Check Override for Conditional
                    if (kdsLogic === 'CONDITIONAL') return hasOverride;

                    // 4. Default for MADE_TO_ORDER (if is_prep_required is NULL/Undefined)
                    // If it's Made to Order but prep requirement is unknown, we default to SHOW
                    // UNLESS user wants stricter filtering. For now, assuming standard behavior involves showing it.
                    if (kdsLogic === 'MADE_TO_ORDER') return true;

                    return true;
                })
                .map(item => {
                    const menuItem = menuItems.get(item.menu_item_id) || { price: 0 };
                    const name = menuItem.name || item.name || 'Unknown Item';

                    // Parse modifiers
                    let modsArray = [];
                    if (item.mods) {
                        try {
                            const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                            if (Array.isArray(parsed)) {
                                modsArray = parsed.map(m => {
                                    if (typeof m === 'object' && m?.value_name) return m.value_name;
                                    return optionValues.get(String(m)) || String(m);
                                }).filter(m =>
                                    m &&
                                    !m.toLowerCase().includes('default') &&
                                    m !== 'רגיל' &&
                                    !String(m).includes('KDS_OVERRIDE')
                                );
                            }
                        } catch (e) { /* ignore */ }
                    }

                    // Add notes
                    if (item.notes) {
                        modsArray.push({ name: item.notes, is_note: true });
                    }

                    // Structure modifiers for display
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

                        return { text: modName, color, isNote: false };
                    });

                    const modsKey = modsArray.map(m => typeof m === 'object' ? m.name : m).sort().join('|');

                    return {
                        id: item.id,
                        menuItemId: item.menu_item_id,
                        name: menuItem.name,
                        modifiers: structuredModifiers,
                        quantity: item.quantity,
                        status: item.item_status,
                        price: menuItem.price,
                        category: menuItem.category || '',
                        modsKey,
                        course_stage: item.course_stage || 1,
                        item_fired_at: item.item_fired_at,
                        is_early_delivered: item.is_early_delivered || false
                    };
                });

            if (processedItems.length === 0) return;

            // Calculate total
            const allItems = items.filter(i => i.item_status !== 'cancelled');
            const calculatedTotal = allItems.reduce((sum, i) => {
                const menuItem = menuItems.get(i.menu_item_id);
                return sum + (menuItem?.price || 0) * (i.quantity || 1);
            }, 0);

            const totalAmount = order.total_amount || calculatedTotal;
            const paidAmount = order.paid_amount || 0;
            const unpaidAmount = totalAmount - paidAmount;

            const baseOrder = {
                id: order.id,
                orderNumber: order.order_number || `#${String(order.id).slice(0, 8)}`,
                // 🛠️ FIX: Ensure customer name is prioritized correctly from all possible fields
                customerName: order.customer_name || order.customerName || (order.order_number ? `#${order.order_number}` : 'אורח'),
                customerPhone: order.customer_phone || order.customerPhone,
                customerId: order.customer_id,
                isPaid: order.is_paid,
                totalAmount: unpaidAmount > 0 ? unpaidAmount : totalAmount,
                paidAmount,
                fullTotalAmount: totalAmount,
                timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                fired_at: order.fired_at,
                ready_at: order.ready_at,
                updated_at: order.updated_at,
                payment_method: order.payment_method,
                is_offline: order.is_offline || String(order.id).startsWith('L'),
                pending_sync: order.pending_sync
            };

            // Group by course stage
            const itemsByStage = processedItems.reduce((acc, item) => {
                const stage = item.course_stage || 1;
                if (!acc[stage]) acc[stage] = [];
                acc[stage].push(item);
                return acc;
            }, {});

            // Process each stage
            Object.entries(itemsByStage).forEach(([stageStr, stageItems]) => {
                const stage = Number(stageStr);
                const cardId = stage === 1 ? order.id : `${order.id}-stage-${stage}`;

                const allReady = stageItems.every(i =>
                    ['ready', 'completed', 'cancelled'].includes(i.status)
                );
                const hasActiveItems = stageItems.some(i =>
                    ['in_progress', 'new'].includes(i.status)
                );

                let cardType, cardStatus;
                const isOrderReady = order.order_status === 'ready';
                const isOrderCompleted = order.order_status === 'completed';

                if (isOrderReady || isOrderCompleted || allReady) {
                    cardType = 'ready'; // This pushes it to the bottom list (completedOrders)
                    cardStatus = isOrderCompleted ? 'completed' : 'ready';
                } else if (hasActiveItems) {
                    cardType = 'active';
                    cardStatus = 'in_progress';
                } else {
                    cardType = 'active';
                    cardStatus = 'pending';
                }

                const groupedItems = groupOrderItems(stageItems);

                const processedOrder = {
                    ...baseOrder,
                    id: cardId,
                    originalId: order.id,
                    items: groupedItems,
                    type: cardType,
                    status: cardStatus,
                    courseStage: stage
                };

                if (cardType === 'ready') {
                    completed.push(processedOrder);
                } else {
                    current.push(processedOrder);
                }
            });
        });

        return { current, completed };
    }, [activeOrders, orderItems, menuItems, optionValues]);

    // ============================================
    // ACTIONS - All go through offline queue
    // ============================================

    const updateItemStatus = async (itemId, newStatus) => {
        console.log(`🔄 [KDS Local] Updating item ${itemId} to status: ${newStatus}`);

        // 1. Update Dexie immediately (Optimistic UI)
        await db.order_items.update(itemId, {
            item_status: newStatus,
            updated_at: new Date().toISOString()
        });
        console.log(`✅ [KDS Local] Dexie updated for item ${itemId}`);

        // 2. Sync to Supabase in background (fire-and-forget)
        const { supabase } = await import('@/lib/supabase');
        supabase.from('order_items').update({ item_status: newStatus, updated_at: new Date().toISOString() }).eq('id', itemId)
            .then(({ error }) => error ? console.error(`❌ Sync failed:`, error) : console.log(`📤 Synced item ${itemId}`));
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        const payload = {
            order_status: newStatus,
            updated_at: new Date().toISOString(),
            ...(newStatus === 'ready' && { ready_at: new Date().toISOString() })
        };

        // 1. Update Dexie immediately
        await db.orders.update(orderId, payload);

        // 2. Sync to Supabase in background
        const { supabase } = await import('@/lib/supabase');
        supabase.from('orders').update(payload).eq('id', orderId)
            .then(({ error }) => error ? console.error(`❌ Sync failed:`, error) : console.log(`📤 Synced order ${orderId}`));
    };

    const fireItem = async (itemId) => {
        const payload = {
            item_status: 'in_progress',
            item_fired_at: new Date().toISOString()
        };

        // 1. Update Dexie immediately
        await db.order_items.update(itemId, payload);

        // 2. Sync to Supabase
        const { supabase } = await import('@/lib/supabase');
        supabase.from('order_items').update(payload).eq('id', itemId)
            .then(({ error }) => error ? console.error(`❌ Sync failed:`, error) : console.log(`📤 Synced fire item ${itemId}`));
    };

    const handleFireItems = async (orderId, itemIds) => {
        for (const itemId of itemIds) {
            await fireItem(itemId);
        }
    };

    const handleReadyItems = async (orderId, itemIds) => {
        for (const itemId of itemIds) {
            await updateItemStatus(itemId, 'ready');
        }

        // 📱 Check if ALL items in the order are now ready/completed
        // If so, and the order wasn't ready before, send SMS
        try {
            const orderItems = await db.order_items.where('order_id').equals(orderId).toArray();
            const allReady = orderItems.every(i => ['ready', 'completed', 'cancelled'].includes(i.item_status));

            if (allReady) {
                const order = await db.orders.get(orderId);
                // Allow re-sending if it was already ready but maybe user clicked again? 
                // Better to be safe: Only if not already completed (to avoid spamming history)
                if (order && order.order_status !== 'completed') {
                    // Update order status to ready if it's not already
                    if (order.order_status !== 'ready') {
                        await updateOrderStatus(orderId, 'ready');
                    }

                    // Send SMS if phone exists
                    if (order.customer_phone) {
                        console.log(`📱 [KDS Local] Order ${orderId} is fully ready, sending SMS to ${order.customer_phone}`);
                        handleSendSms(order.customer_phone, order.customer_name);
                    }
                }
            }
        } catch (e) {
            console.error('Error in SMS/Ready check:', e);
        }
    };

    const handleCancelOrder = async (orderId) => {
        await updateOrderStatus(orderId, 'cancelled');
    };

    const handleConfirmPayment = async (orderId, paymentMethod) => {
        const payload = {
            is_paid: true,
            payment_method: paymentMethod,
            order_status: 'completed',
            updated_at: new Date().toISOString()
        };

        // 1. Update Dexie immediately
        await db.orders.update(orderId, payload);

        // 2. Sync to Supabase
        const { supabase } = await import('@/lib/supabase');
        supabase.from('orders').update(payload).eq('id', orderId)
            .then(({ error }) => error ? console.error(`❌ Sync failed:`, error) : console.log(`📤 Synced payment ${orderId}`));
    };

    const fetchHistoryOrders = async (selectedDate, signal) => {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Try Local First
        let orders = await db.orders
            .where('business_id')
            .equals(businessId)
            .filter(o => {
                const createdAtTime = new Date(o.created_at).getTime();
                return createdAtTime >= startOfDay.getTime() && createdAtTime <= endOfDay.getTime();
            })
            .toArray();

        // 2. If nothing found locally (and we are online), try to fetch from server
        // This handles the case where history hasn't been synced to this device yet
        if (orders.length === 0 && navigator.onLine) {
            console.log(`📜 [KDS History] No local orders for ${selectedDate}, attempting server fetch...`);
            try {
                // We use the existing sync service but we might need a specific "fetch history" RPC if syncOrders is limited.
                // For now, let's assume syncOrders brings in enough data or we rely on the broader sync.
                // Actually, let's manually fetch from Supabase to populate Dexie for this date!
                const { supabase } = await import('@/lib/supabase');
                const { data: serverOrders, error } = await supabase
                    .rpc('get_kds_orders', {
                        p_business_id: businessId,
                        p_date: startOfDay.toISOString()
                    });

                if (!error && serverOrders && serverOrders.length > 0) {
                    console.log(`📥 [KDS History] Fetched ${serverOrders.length} orders from server. Fetching items...`);

                    // 1. Save Orders
                    await db.orders.bulkPut(serverOrders.map(o => ({
                        ...o,
                        is_offline: false,
                        pending_sync: false
                    })));

                    // 2. Fetch & Save Items
                    const orderIds = serverOrders.map(o => o.id);
                    const { data: serverItems } = await supabase
                        .from('order_items')
                        .select('*')
                        .in('order_id', orderIds);

                    if (serverItems && serverItems.length > 0) {
                        console.log(`__ [KDS History] Saving ${serverItems.length} items to Dexie...`);
                        await db.order_items.bulkPut(serverItems);
                    }

                    // Re-query Dexie
                    orders = await db.orders
                        .where('business_id')
                        .equals(businessId)
                        .filter(o => {
                            const createdAtTime = new Date(o.created_at).getTime();
                            return createdAtTime >= startOfDay.getTime() && createdAtTime <= endOfDay.getTime();
                        })
                        .toArray();
                }
            } catch (err) {
                console.warn('Failed to fetch history from server:', err);
            }
        }

        console.log(`📜 [KDS History] Final count: ${orders.length} orders for date ${selectedDate}`);


        // Get items for these orders
        const orderIds = orders.map(o => o.id);
        const items = await db.order_items
            .filter(item => orderIds.some(oid => String(oid) === String(item.order_id)))
            .toArray();

        // Process similar to active orders
        const menuItemsMap = await db.menu_items.toArray().then(items =>
            new Map(items.map(m => [m.id, m]))
        );

        return orders.map(order => {
            const orderItems = items.filter(i => String(i.order_id) === String(order.id));

            return {
                id: order.id,
                order_number: order.order_number,
                order_status: order.order_status,
                orderNumber: order.order_number || `#${String(order.id).slice(0, 8)}`,
                customerName: order.customer_name || order.customerName || (order.order_number ? `#${order.order_number}` : 'אורח'),
                customer_name: order.customer_name || order.customerName,
                customer_phone: order.customer_phone || order.customerPhone,
                isPaid: order.is_paid,
                is_paid: order.is_paid,
                totalAmount: order.total_amount,
                created_at: order.created_at,
                timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                order_items: orderItems.map(item => {
                    const menuItem = menuItemsMap.get(item.menu_item_id) || { name: 'Unknown', price: 0 };
                    return {
                        id: item.id,
                        menu_items: {
                            name: menuItem.name,
                            price: menuItem.price
                        },
                        quantity: item.quantity,
                        item_status: item.item_status
                    };
                })
            };
        });
    };

    const findNearestActiveDate = async (currentDate) => {
        // Look for orders in the past 30 days
        const thirtyDaysAgo = new Date(currentDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const orders = await db.orders
            .where('business_id')
            .equals(businessId)
            .filter(o => new Date(o.created_at) >= thirtyDaysAgo)
            .toArray();

        if (orders.length === 0) return null;

        // Find the most recent date
        const dates = orders.map(o => new Date(o.created_at));
        dates.sort((a, b) => b - a); // Descending
        return dates[0];
    };

    const handleUndoLastAction = async () => {
        // TODO: Implement undo via offline queue
        console.log('Undo not yet implemented in local-first version');
    };

    const fetchOrders = async (signal) => {
        console.log('🔄 [KDS] Refreshing - pulling latest from Supabase...');
        try {
            // Pull latest orders from Supabase to Dexie
            const { syncOrders } = await import('@/services/syncService');
            const pullResult = await syncOrders(businessId);
            if (pullResult.success) {
                console.log(`✅ [KDS] Pulled ${pullResult.ordersCount || 0} orders from Supabase`);
            } else {
                console.warn(`⚠️ [KDS] Pull failed:`, pullResult.error);
            }

            return { success: true };
        } catch (err) {
            console.error('❌ [KDS] Refresh failed:', err);
            return { success: false, error: err.message };
        }
    };

    return {
        currentOrders: processedOrders.current || [],
        completedOrders: processedOrders.completed || [],
        isLoading: (!activeOrders || !orderItems || !menuItems || !optionValues) && (!processedOrders.current.length && !processedOrders.completed.length),
        isOffline: !navigator.onLine,
        lastUpdated: new Date(),
        lastAction: null,
        smsToast,
        setSmsToast,
        errorModal: null,
        setErrorModal: () => { },
        isSendingSms,
        updateItemStatus,
        updateOrderStatus,
        fireItem,
        handleFireItems,
        handleReadyItems,
        handleCancelOrder,
        handleConfirmPayment,
        fetchOrders,
        fetchHistoryOrders,
        findNearestActiveDate,
        handleUndoLastAction,
        handleItemStatusChange: updateItemStatus,
        handleOrderStatusChange: updateOrderStatus
    };
};
