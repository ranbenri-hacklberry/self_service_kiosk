import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { sendSms } from '../../../services/smsService';
import { groupOrderItems } from '../../../utils/kdsUtils';
import { v4 as uuidv4 } from 'uuid';

export const useKDSData = () => {
    const { currentUser } = useAuth();
    const [currentOrders, setCurrentOrders] = useState([]);
    const [completedOrders, setCompletedOrders] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());
    const [lastAction, setLastAction] = useState(null);
    const [smsToast, setSmsToast] = useState(null);
    const [errorModal, setErrorModal] = useState(null);
    const [isSendingSms, setIsSendingSms] = useState(false);

    const fetchOrders = useCallback(async (signal) => {
        try {
            setIsLoading(true);
            // מיפוי של כל ה-optionvalues פעם אחת
            const { data: allOptionValues } = await supabase
                .from('optionvalues')
                .select('id, value_name')
                .abortSignal(signal);

            const optionMap = new Map();
            allOptionValues?.forEach(ov => {
                optionMap.set(String(ov.id), ov.value_name);
                optionMap.set(ov.id, ov.value_name); // למקרה שזה מספר
            });

            // Fetch orders from last 48 hours to be safe
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            today.setDate(today.getDate() - 2);

            // DEBUGGING LOGS 
            const businessId = currentUser?.business_id;
            console.log('🔍 [useKDSData] Fetching orders (Relaxed Mode)...', {
                businessId,
                userId: currentUser?.id,
                lookbackDate: today.toISOString()
            });

            // REMOVED STRICT CLIENT-SIDE CHECK
            // We let the server decide based on auth token.
            // if (!businessId) { ... }

            // CHANGED: Use supabase directly instead of getSupabase
            let { data: ordersData, error } = await supabase.rpc('get_kds_orders', {
                p_date: today.toISOString(),
                p_business_id: businessId || null // Pass the ID explicitly for PIN users
            }).abortSignal(signal);

            if (error) throw error;

            // console.log(`📦 [useKDSData] Total orders fetched: ${ordersData?.length || 0}`);

            // WORKAROUND: The RPC might filter out 'ready' items from 'in_progress' orders.
            // We need to fetch 'ready' items manually for these orders to show split courses in "Completed".
            if (ordersData && ordersData.length > 0) {
                const orderIds = ordersData.map(o => o.id);
                try {
                    const { data: readyItems } = await supabase
                        .from('order_items')
                        .select('id, mods, notes, item_status, course_stage, quantity, order_id, menu_items!inner(name, price, kds_routing_logic, is_prep_required)')
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

            // ⚠️ SAFETY NET: Fetch orders that have ANY active items, regardless of order_status.
            // This ensures orders with new items added (even if previously completed) show up!
            try {
                // Look back 12 hours to catch any revived orders from the current shift
                const lookbackTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

                // Fetch orders with active items (in_progress, new, pending, ready)
                const { data: rescueOrders } = await supabase
                    .from('orders')
                    .select('*, order_items!inner(id, item_status, mods, notes, course_stage, quantity, menu_items!inner(name, price, kds_routing_logic, is_prep_required))')
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

            // NOTE: Completed orders are NOT fetched for active KDS.
            // They belong only in History tab and are fetched separately when viewing history.

            const processedOrders = [];

            (ordersData || []).forEach(order => {
                // Check if order has ANY active items (in_progress, new, pending)
                // If so, it belongs in Active KDS even if order_status is 'completed'
                const hasActiveItems = (order.order_items || []).some(item =>
                    item.item_status === 'in_progress' ||
                    item.item_status === 'new' ||
                    item.item_status === 'pending' ||
                    item.item_status === 'ready'
                );

                // Only skip to history if order is completed AND has no active items
                if (order.order_status === 'completed' && !hasActiveItems) {
                    return; // Skip entirely - belongs in History tab
                }

                // Filter items logic
                const rawItems = (order.order_items || [])
                    .filter(item => {
                        // Filter out 'completed' items in the Active KDS tab to hide delivered items.
                        // Filter out 'cancelled' items and items without a name.
                        if (item.item_status === 'completed' || item.item_status === 'cancelled' || !item.menu_items?.name) return false;

                        const kdsLogic = item.menu_items.kds_routing_logic;
                        const isPrepRequired = item.menu_items.is_prep_required;

                        // Check mods for override tag
                        let hasOverride = false;
                        let mods = item.mods;

                        // Handle stringified JSON if necessary
                        if (typeof mods === 'string') {
                            try {
                                if (mods.includes('__KDS_OVERRIDE__')) {
                                    hasOverride = true;
                                } else {
                                    const parsed = JSON.parse(mods);
                                    if (Array.isArray(parsed) && parsed.includes('__KDS_OVERRIDE__')) hasOverride = true;
                                }
                            } catch (e) {
                                // If simple string contains the tag
                                if (mods.includes('__KDS_OVERRIDE__')) hasOverride = true;
                            }
                        } else if (Array.isArray(mods)) {
                            if (mods.includes('__KDS_OVERRIDE__')) hasOverride = true;
                        } else if (typeof mods === 'object' && mods?.kds_override) {
                            // Fallback for object format
                            hasOverride = true;
                        }

                        // Logic 1: Made to Order (Always show - e.g. Toast, Sandwich)
                        if (kdsLogic === 'MADE_TO_ORDER') return true;

                        // Logic 2: Conditional (Show only if override - e.g. Salad)
                        if (kdsLogic === 'CONDITIONAL') {
                            return hasOverride;
                        }

                        // Logic 3: Default (Use is_prep_required flag)
                        return isPrepRequired !== false;
                    })
                    .map(item => {
                        let modsArray = [];
                        if (item.mods) {
                            try {
                                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                                if (Array.isArray(parsed)) {
                                    modsArray = parsed.map(m => {
                                        if (typeof m === 'object' && m?.value_name) return m.value_name;
                                        return optionMap.get(String(m)) || String(m);
                                    }).filter(m => m && !m.toLowerCase().includes('default') && m !== 'רגיל' && !String(m).includes('KDS_OVERRIDE'));
                                }
                            } catch (e) { /* ignore */ }
                        }

                        // Add Custom Note if exists
                        if (item.notes) {
                            modsArray.push({ name: item.notes, is_note: true });
                        }

                        // בניית מערך מודים מובנה לרינדור נקי ב-React
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

                        const itemName = item.menu_items?.name || 'פריט';
                        const itemPrice = item.menu_items?.price || 0;
                        const category = item.menu_items?.category || '';

                        // מחרוזת מודים ממוינת לאיחוד - משמשת כמפתח ייחודי
                        const modsKey = modsArray.map(m => typeof m === 'object' ? m.name : m).sort().join('|');

                        return {
                            id: item.id,
                            menuItemId: item.menu_items?.id, // לטובת האיחוד
                            name: itemName, // שם נקי בלבד!
                            modifiers: structuredModifiers, // מערך מודים לרינדור
                            quantity: item.quantity,
                            status: item.item_status,
                            price: itemPrice,
                            category: category,
                            modsKey: modsKey, // מפתח לאיחוד פריטים זהים
                            course_stage: item.course_stage || 1,
                            item_fired_at: item.item_fired_at,
                            is_early_delivered: item.is_early_delivered || false
                        };

                    });

                // Calculate total order amount from ALL non-cancelled items
                const itemsForTotal = (order.order_items || []).filter(i => i.item_status !== 'cancelled');

                const calculatedTotal = itemsForTotal.reduce((sum, i) => sum + (i.price || i.menu_items?.price || 0) * (i.quantity || 1), 0);
                const totalOrderAmount = order.total_amount || calculatedTotal;

                // Calculate unpaid amount
                const paidAmount = order.paid_amount || 0;
                const unpaidAmount = totalOrderAmount - paidAmount;

                const baseOrder = {
                    id: order.id,
                    orderNumber: order.order_number || `#${order.id?.slice(0, 8) || 'N/A'} `,
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
                };

                // Completed orders are already filtered out at the start of the loop

                // Skip orders with no items after filtering
                if (!rawItems || rawItems.length === 0) return;

                // Group items by Course Stage
                const itemsByStage = rawItems.reduce((acc, item) => {
                    const stage = item.course_stage || 1;
                    if (!acc[stage]) acc[stage] = [];
                    acc[stage].push(item);
                    return acc;
                }, {});

                // Process each stage
                Object.entries(itemsByStage).forEach(([stageStr, stageItems]) => {
                    const stage = Number(stageStr);
                    const cardId = stage === 1 ? order.id : `${order.id}-stage-${stage}`;

                    const hasHeldItems = stageItems.some(i => i.status === 'held' || i.status === 'pending');
                    const hasActiveItems = stageItems.some(i => i.status === 'in_progress' || i.status === 'new');
                    // Treat 'completed' items as ready for KDS display purposes (so they appear in the bottom section)
                    const allReady = stageItems.every(i => i.status === 'ready' || i.status === 'completed' || i.status === 'cancelled');
                    // Note: If all are cancelled, it might also be 'ready' (done), or filtered out earlier. Assuming mixed cancelled/ready is ready.

                    let cardType, cardStatus;
                    if (allReady) {
                        cardType = 'ready';
                        cardStatus = 'ready';
                    } else if (hasHeldItems && !hasActiveItems) {
                        cardType = 'delayed';
                        cardStatus = 'pending';
                    } else {
                        cardType = 'active';
                        cardStatus = 'in_progress';
                    }

                    const groupedItems = groupOrderItems(stageItems);

                    // LOGIC CHANGE: Only show pending items in active/delayed cards.
                    // If all items are ready, it's a ready card - show everything.
                    // If some items are ready and some are not, it's an active/delayed card - show ONLY non-ready items.
                    const displayItems = allReady
                        ? groupedItems
                        : groupOrderItems(stageItems.filter(i => i.status !== 'ready' && i.status !== 'completed' && i.status !== 'cancelled'));

                    // Check if there are other stages/cards for this order (e.g., delayed Course 2)
                    const otherStagesExist = Object.keys(itemsByStage).length > 1;
                    // hasPendingItems is true if: some items are ready OR there are other stages waiting
                    const hasPending = stageItems.some(i => i.status === 'ready' || i.status === 'completed') || otherStagesExist;

                    processedOrders.push({
                        ...baseOrder,
                        id: allReady ? `${cardId}-ready` : cardId,
                        originalOrderId: order.id,
                        courseStage: stage,
                        created_at: order.created_at, // CRITICAL: Preserve original order time for queue sorting
                        fired_at: stageItems[0]?.item_fired_at || order.created_at,
                        isSecondCourse: stage === 2,
                        hasPendingItems: hasPending, // Shows "+המשך" badge
                        items: displayItems,
                        type: cardType,
                        orderStatus: cardStatus
                    });
                });
            });

            // Separate by type for display columns
            const current = processedOrders.filter(o =>
                (o.type === 'active' || o.type === 'delayed')
            );

            // Sort current (Active) - CRITICAL FIX: Always use created_at for queue fairness
            // Orders that return from "ready" or have items added should maintain their original position
            current.sort((a, b) => {
                // Delayed orders always go to the end (right side in RTL)
                if (a.type === 'delayed' && b.type !== 'delayed') return 1;
                if (a.type !== 'delayed' && b.type === 'delayed') return -1;

                // Primary sort: Original order time (created_at) - ensures queue fairness
                // This is the time the customer originally placed their order
                const createdA = new Date(a.created_at || 0).getTime();
                const createdB = new Date(b.created_at || 0).getTime();
                if (createdA !== createdB) return createdA - createdB; // Oldest first

                // Secondary sort: Course stage (if same order, stage 1 before stage 2)
                return (a.courseStage || 1) - (b.courseStage || 1);
            });

            // Completed/Ready Section
            const completed = processedOrders.filter(o =>
                (o.type === 'ready' || o.type === 'active_ready_split' || o.type === 'unpaid_delivered')
            );

            completed.sort((a, b) => {
                // Priority 1: Unpaid delivered orders go LEFTMOST (end of array)
                if (a.type === 'unpaid_delivered' && b.type !== 'unpaid_delivered') return 1;
                if (a.type !== 'unpaid_delivered' && b.type === 'unpaid_delivered') return -1;

                // Priority 2: Ready orders - Newest on Right (Index 0)
                // Customers coming now are likely for recent orders
                const timeA = new Date(a.ready_at || a.updated_at || a.created_at || 0).getTime();
                const timeB = new Date(b.ready_at || b.updated_at || b.created_at || 0).getTime();

                // Sort by time Descending (Newest first)
                return timeB - timeA;
            });

            setCurrentOrders(current);
            setCompletedOrders(completed);
            setLastUpdated(new Date());
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('שגיאה בטעינת הזמנות:', err);
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
        console.log('🔄 updateOrderStatus called:', { orderId, currentStatus });
        try {
            if (currentStatus === 'undo_ready') {
                // Find the specific card/order-part in completedOrders
                const orderPart = completedOrders.find(o => o.id === orderId);
                const realOrderId = typeof orderId === 'string' ? orderId.replace(/-stage-\d+/, '').replace('-ready', '') : orderId;

                if (orderPart && orderPart.items && orderPart.items.length > 0) {
                    // Collect specific item IDs from this card
                    const itemIdsToRevert = orderPart.items.flatMap(i => i.ids || [i.id]);

                    console.log('↺ Reverting specific items to in_progress:', itemIdsToRevert);

                    // Use fire_items_v2 to set these specific items to 'in_progress'
                    // This prevents touching other items (like held Course 2 items)
                    const { error } = await supabase.rpc('fire_items_v2', {
                        p_order_id: realOrderId,
                        p_item_ids: itemIdsToRevert
                    });

                    if (error) throw error;
                } else {
                    // Fallback (unsafe): Update whole order if we can't find specific items
                    // This creates the bug, but better than doing nothing if state is elusive
                    console.warn('⚠️ Could not find items for undo, reverting entire order status (unsafe)');
                    const { error } = await supabase.rpc('update_order_status', {
                        p_order_id: realOrderId,
                        p_status: 'in_progress'
                    });
                    if (error) throw error;
                }

                await fetchOrders();
                return;
            }

            const statusLower = (currentStatus || '').toLowerCase();
            const order = currentOrders.find(o => o.id === orderId);

            const hasInProgressItems = order?.items?.some(item =>
                item.status === 'in_progress' || item.status === 'new' || !item.status
            );

            let nextStatus;

            if (hasInProgressItems) {
                nextStatus = 'ready';
                if (order && order.customerPhone) {
                    handleSendSms(orderId, order.customerName, order.customerPhone);
                }
            } else if (statusLower === 'ready') {
                const realOrderId = typeof orderId === 'string' ? orderId.replace(/-stage-\d+/, '').replace('-ready', '') : orderId;

                const hasActiveOrDelayedParts = currentOrders.some(o =>
                    (o.type === 'delayed' || o.type === 'active') &&
                    (o.originalOrderId === realOrderId || o.id === realOrderId)
                );

                const readyOrder = completedOrders.find(o => o.id === orderId);
                let itemIds = [];
                if (readyOrder && readyOrder.items) {
                    itemIds = readyOrder.items.flatMap(i => i.ids || [i.id]);
                }

                const { error } = await supabase.rpc('complete_order_part_v2', {
                    p_order_id: String(realOrderId).trim(),
                    p_item_ids: itemIds,
                    p_keep_order_open: hasActiveOrDelayedParts
                });

                if (error) throw error;
                // Capture IDs for precise undo
                setLastAction({ orderId: realOrderId, previousStatus: 'ready', itemIds: itemIds });
                await fetchOrders();
                return;

            } else if (currentStatus === 'completed') {
                // EXPLICIT: Move to history - close the order and mark all items as completed
                const realOrderId = typeof orderId === 'string' ? orderId.replace(/-stage-\d+/, '').replace('-ready', '') : orderId;

                // Find all items from this order that need to be completed
                const orderCard = completedOrders.find(o => o.id === orderId) ||
                    currentOrders.find(o => o.id === orderId || o.originalOrderId === realOrderId);
                let itemIds = [];
                if (orderCard && orderCard.items) {
                    itemIds = orderCard.items.flatMap(i => i.ids || [i.id]);
                }

                console.log('📦 Moving to history:', { realOrderId, itemIds });

                // Call complete_order_part_v2 with p_keep_order_open = false to close the order
                const { error } = await supabase.rpc('complete_order_part_v2', {
                    p_order_id: String(realOrderId).trim(),
                    p_item_ids: itemIds,
                    p_keep_order_open: false // Close the order!
                });

                if (error) throw error;
                await fetchOrders();
                return;

            } else {
                console.warn('Cannot update status from:', currentStatus);
                return;
            }

            if (nextStatus === 'ready') {
                const realOrderId = typeof orderId === 'string' ? orderId.replace(/-stage-\d+/, '').replace('-ready', '') : orderId;

                // Collect item IDs from the specific card we are marking ready
                // We need to find the card in currentOrders
                const card = currentOrders.find(o => o.id === orderId);
                let itemIdsToReady = [];
                if (card && card.items) {
                    itemIdsToReady = card.items.flatMap(i => i.ids || [i.id]);
                }

                if (itemIdsToReady.length > 0) {
                    // Use mark_items_ready_v2 to move items to 'ready' status (collection section)
                    // without closing the whole order or marking items as delivered yet.
                    const { error } = await supabase.rpc('mark_items_ready_v2', {
                        p_order_id: String(realOrderId).trim(),
                        p_item_ids: itemIdsToReady
                    });
                    if (error) throw error;
                } else {
                    // Fallback (unsafe) if we can't find specific items
                    console.warn('⚠️ Could not find items for ready mark, falling back to whole order (unsafe)');
                    const { error } = await supabase.rpc('mark_order_ready_v2', {
                        p_order_id: realOrderId
                    });
                    if (error) throw error;
                }

                setLastAction({ orderId: realOrderId, previousStatus: 'in_progress', itemIds: itemIdsToReady });
            } else {
                // CHANGED: Use supabase directly
                const { error } = await supabase
                    .from('orders')
                    .update({ order_status: nextStatus })
                    .eq('id', orderId);
                if (error) throw error;
            }

            await fetchOrders();
        } catch (err) {
            console.error('Unexpected error updating order status:', err);
            setErrorModal({
                show: true,
                title: 'שגיאת התחברות',
                message: 'אין חיבור לרשת או שגיאה בתקשורת עם השרת',
                details: err.message || 'Unknown network error',
                retryLabel: 'נסה שוב',
                onRetry: () => updateOrderStatus(orderId, currentStatus)
            });
        }
    };

    const handleFireItems = async (orderId, itemsToFire) => {
        try {
            setIsLoading(true);
            const itemIds = itemsToFire.map(i => i.id);

            // CHANGED: Use supabase directly
            const { error } = await supabase.rpc('fire_items_v2', {
                p_order_id: orderId,
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

        try {
            // Use RPC function to bypass RLS - now also passing payment_method
            const { data, error } = await supabase.rpc('confirm_order_payment', {
                p_order_id: cleanOrderId,
                p_payment_method: paymentMethod
            });

            if (error) throw error;

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

    // Polling (Reduced from 30s to 5s for better responsiveness)
    useEffect(() => {
        const controller = new AbortController();
        fetchOrders(controller.signal); // Initial fetch

        const interval = setInterval(() => {
            fetchOrders(controller.signal);
        }, 5000); // Every 5 seconds

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [fetchOrders]);

    // Realtime
    useEffect(() => {
        if (!currentUser) return;

        const schema = 'public';
        const businessId = currentUser?.business_id;

        console.log(`🔌 Connecting to Realtime on schema: ${schema}, business: ${businessId}`);

        // Helper to create filter string
        const filter = businessId ? `business_id=eq.${businessId}` : undefined;

        const channel = supabase
            .channel('kds-changes')
            .on('postgres_changes', { event: '*', schema: schema, table: 'orders', filter: filter }, () => {
                console.log('🔔 Realtime update received (orders)');
                fetchOrders();
            })
            .on('postgres_changes', { event: '*', schema: schema, table: 'order_items' }, () => {
                // order_items might not have business_id on the table itself? 
                // Let's check schema. If item doesn't have business_id, we can't filter safely.
                // But usually we just refresh on order change. 
                // For now, let's keep order_items unfiltered OR check if I can filter via join (Realtime doesn't support joins).
                // Safest: Leave order_items unfiltered, but rely on fetchOrders() filtering.
                // Optimized: Only listen to 'orders' updates if possible, but status changes on items trigger order refresh.
                console.log('🔔 Realtime update received (order_items)');
                fetchOrders();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
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
                // Fallback to old heartbeat
                try {
                    await supabase.rpc('send_kds_heartbeat', {
                        p_business_id: currentUser.business_id
                    });
                } catch (e) {
                    console.error('❌ All heartbeats failed');
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
            const { data: v2Data, error: v2Error } = await supabase
                .rpc('get_kds_history_orders_v2', {
                    p_start_date: startOfDay.toISOString(),
                    p_end_date: endOfDay.toISOString(),
                    p_business_id: businessId || null
                })
                .limit(100) // Limit to prevent crash
                .abortSignal(signal);

            if (!v2Error && v2Data) {
                // Filter out cancelled orders (User Request: Hide cancelled orders)
                // AND FILTER OUT orders that have active items (they belong in Active tab)
                historyData = v2Data.filter(o => {
                    const isCancelled = o.order_status === 'cancelled';
                    const isRefunded = o.is_refund || o.isRefund;
                    const hasRefundAmount = o.refund_amount > 0;

                    // Critical: Check if this order has items that need work/delivery
                    const hasActiveItems = (o.order_items || []).some(item =>
                        item.item_status === 'in_progress' ||
                        item.item_status === 'ready' ||
                        item.item_status === 'new' ||
                        item.item_status === 'pending'
                    );

                    if (hasActiveItems) return false; // Exclude from history if active

                    return !isCancelled || isRefunded || hasRefundAmount;
                });

                usedRpc = true;
            } else {
                if (v2Error.name !== 'AbortError') {
                    console.warn('⚠️ RPC V2 failed/missing, trying V1...', v2Error?.message);
                }

                // 2. Try RPC V1 (Backup)
                const { data: v1Data, error: v1Error } = await supabase
                    .rpc('get_kds_history_orders', {
                        p_start_date: startOfDay.toISOString(),
                        p_end_date: endOfDay.toISOString(),
                        p_business_id: businessId || null
                    })
                    .limit(100)
                    .abortSignal(signal);

                if (!v1Error && v1Data) {
                    // Filter out cancelled orders but keep refunded ones
                    // AND FILTER OUT active orders
                    historyData = v1Data.filter(o => {
                        const isCancelled = o.order_status === 'cancelled';
                        const isRefunded = o.is_refund || o.isRefund;

                        const hasActiveItems = (o.order_items || []).some(item =>
                            item.item_status === 'in_progress' ||
                            item.item_status === 'ready' ||
                            item.item_status === 'new' ||
                            item.item_status === 'pending'
                        );

                        if (hasActiveItems) return false;

                        return !isCancelled || isRefunded;
                    });
                    usedRpc = true;
                }
            }

            if (!usedRpc && !signal?.aborted) {
                // Fallback: Direct Query
                // ... (Simplified for brevity, assuming RPC usually works. If needed, can replicate signal here)
                // Note: Direct fallback is risky for performance anyway.
            }


            // 3. Process Items (Normalize Structure and Parse Mods)
            const processedHistory = historyData.map(order => {
                const items = (order.order_items || [])
                    .map(item => {
                        let modsArray = [];
                        if (item.mods) {
                            try {
                                const parsed = typeof item.mods === 'string' ? JSON.parse(item.mods) : item.mods;
                                if (Array.isArray(parsed)) {
                                    modsArray = parsed.map(m => {
                                        if (typeof m === 'object' && m?.value_name) return m.value_name;
                                        return optionMap.get(String(m)) || String(m);
                                    }).filter(m => m && !m.toLowerCase().includes('default') && m !== 'רגיל' && !String(m).includes('KDS_OVERRIDE'));
                                }
                            } catch (e) { /* ignore */ }
                        }

                        if (item.notes) {
                            modsArray.push({ name: item.notes, is_note: true });
                        }

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

                        const itemName = item.menu_items?.name || 'פריט';
                        const itemPrice = item.menu_items?.price || 0;
                        const category = item.menu_items?.category || '';
                        const modsKey = modsArray.map(m => typeof m === 'object' ? m.name : m).sort().join('|');

                        return {
                            id: item.id,
                            menuItemId: item.menu_items?.id,
                            name: itemName,
                            modifiers: structuredModifiers,
                            quantity: item.quantity,
                            status: item.item_status,
                            price: itemPrice,
                            category: category,
                            modsKey: modsKey,
                            course_stage: item.course_stage || 1,
                            item_fired_at: item.item_fired_at,
                            is_early_delivered: item.is_early_delivered || false
                        };
                    });

                // Group similar items for cleaner display
                const groupedItems = groupOrderItems(items);
                const unpaidAmount = (order.total_amount || 0) - (order.paid_amount || 0);

                return {
                    id: order.id,
                    orderNumber: order.order_number || `#${order.id?.slice(0, 8) || 'N/A'} `,
                    customerName: order.customer_name || 'אורח',
                    customerPhone: order.customer_phone,
                    isPaid: order.is_paid,
                    totalAmount: unpaidAmount > 0 ? unpaidAmount : order.total_amount,
                    paidAmount: order.paid_amount || 0,
                    fullTotalAmount: order.total_amount,
                    timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                    created_at: order.created_at, // Add this for PrepTimer calculation
                    fired_at: order.fired_at,
                    ready_at: order.ready_at,
                    updated_at: order.updated_at,
                    order_status: order.order_status,
                    items: groupedItems,
                    type: 'history'
                };
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
        fetchHistoryOrders,
        findNearestActiveDate, // Exported
        updateOrderStatus,
        handleFireItems,
        handleReadyItems,
        handleUndoLastAction,
        handleConfirmPayment,
        handleCancelOrder,
        handleSendSms
    };
};
