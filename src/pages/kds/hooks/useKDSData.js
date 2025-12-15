import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { sendSms } from '../../../services/smsService';
import { groupOrderItems } from '../../../utils/kdsUtils';

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

    const fetchOrders = useCallback(async () => {
        try {
            setIsLoading(true);
            // מיפוי של כל ה-optionvalues פעם אחת
            const { data: allOptionValues } = await supabase
                .from('optionvalues')
                .select('id, value_name');

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
            const { data: ordersData, error } = await supabase.rpc('get_kds_orders', {
                p_date: today.toISOString(),
                p_business_id: businessId || null // Pass the ID explicitly for PIN users
            });

            if (error) throw error;

            console.log(`📦 [useKDSData] Total orders fetched: ${ordersData?.length || 0}`);

            const processedOrders = [];

            (ordersData || []).forEach(order => {
                // SAFETY CHECK: If order is completed AND paid, skip it immediately.
                if (order.order_status === 'completed' && order.is_paid) return;

                // Filter items logic
                const rawItems = (order.order_items || [])
                    .filter(item => {
                        if (item.item_status === 'cancelled' || item.item_status === 'completed' || !item.menu_items?.name) return false;

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
                            item_fired_at: item.item_fired_at
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
                    isPaid: order.is_paid,
                    totalAmount: unpaidAmount > 0 ? unpaidAmount : totalOrderAmount, // Show unpaid amount, or full if nothing paid
                    paidAmount: paidAmount,
                    fullTotalAmount: totalOrderAmount,
                    timestamp: new Date(order.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
                    fired_at: order.fired_at,
                    ready_at: order.ready_at,
                };

                // SPECIAL CASE: Unpaid Delivered Orders
                if (order.order_status === 'completed' && !order.is_paid) {
                    const rawDisplayItems = (order.order_items || [])
                        .filter(item => item.item_status !== 'cancelled' && item.menu_items?.name)
                        .map(item => {
                            const itemName = item.menu_items?.name || 'פריט';
                            return {
                                id: item.id,
                                menuItemId: item.menu_items?.id,
                                name: itemName,
                                quantity: item.quantity,
                                price: item.menu_items?.price || 0,
                                modifiers: [],
                                modsKey: ''
                            };
                        });

                    const displayItems = groupOrderItems(rawDisplayItems);

                    if (displayItems.length > 0) {
                        processedOrders.push({
                            ...baseOrder,
                            orderStatus: 'completed',
                            items: displayItems,
                            type: 'unpaid_delivered'
                        });
                    }
                    return; // Done with this order
                }

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
                    const allReady = stageItems.every(i => i.status === 'ready');

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

                    processedOrders.push({
                        ...baseOrder,
                        id: allReady ? `${cardId}-ready` : cardId,
                        originalOrderId: order.id,
                        courseStage: stage,
                        fired_at: stageItems[0]?.item_fired_at || order.created_at,
                        isSecondCourse: stage === 2,
                        items: groupedItems,
                        type: cardType,
                        orderStatus: cardStatus
                    });
                });
            });

            // Separate by type for display columns
            const current = processedOrders.filter(o =>
                (o.type === 'active' || o.type === 'delayed')
            );

            // Sort current
            current.sort((a, b) => {
                const stageA = a.courseStage || 1;
                const stageB = b.courseStage || 1;
                if (stageA !== stageB) return stageA - stageB;

                const timeA = new Date(a.timestamp).getTime();
                const timeB = new Date(b.timestamp).getTime();
                return timeA - timeB;
            });

            // Completed/Ready Section
            const completed = processedOrders.filter(o =>
                (o.type === 'ready' || o.type === 'active_ready_split' || o.type === 'unpaid_delivered')
            );

            completed.sort((a, b) => {
                if (a.type === 'unpaid_delivered' && b.type !== 'unpaid_delivered') return -1;
                if (a.type !== 'unpaid_delivered' && b.type === 'unpaid_delivered') return 1;
                return 0;
            });

            setCurrentOrders(current);
            setCompletedOrders(completed);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('שגיאה בטעינת הזמנות:', err);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser]); // Added currentUser to dependency array

    const handleSendSms = async (orderId, customerName, phone) => {
        if (!phone) return;

        setIsSendingSms(true);
        setErrorModal(null);

        const message = `היי ${customerName}, ההזמנה שלכם מוכנה! 🎉, מוזמנים לעגלה לאסוף אותה`;

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
        try {
            if (currentStatus === 'undo_ready') {
                const realOrderId = typeof orderId === 'string' && orderId.endsWith('-ready') ? orderId.replace('-ready', '') : orderId;
                const { error } = await supabase.rpc('update_order_status', {
                    p_order_id: realOrderId, // Ensure UUID
                    p_status: 'in_progress'
                });
                if (error) throw error;
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
                const realOrderId = typeof orderId === 'string' && orderId.endsWith('-ready')
                    ? orderId.replace('-ready', '')
                    : orderId;

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

                setLastAction({ orderId: realOrderId, previousStatus: 'ready' });
                await fetchOrders();
                return;

            } else {
                console.warn('Cannot update status from:', currentStatus);
                return;
            }

            if (nextStatus === 'ready') {
                const { error } = await supabase.rpc('mark_order_ready_v2', {
                    p_order_id: orderId
                });
                if (error) throw error;
                setLastAction({ orderId, previousStatus: 'in_progress' });
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
            const { error } = await supabase.rpc('update_order_status', {
                p_order_id: lastAction.orderId,
                p_status: lastAction.previousStatus
            });
            if (error) throw error;
            setLastAction(null);
            await fetchOrders();
        } catch (err) {
            console.error('Failed to undo:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmPayment = async (orderId, amount = null) => {
        // Clean orderId - remove KDS suffixes like "-ready" or "-stage-2"
        let cleanOrderId = orderId;
        if (typeof orderId === 'string') {
            if (orderId.endsWith('-ready')) {
                cleanOrderId = orderId.replace(/-ready$/, '');
            }
            cleanOrderId = cleanOrderId.replace(/-stage-\d+$/, '');
        }

        try {
            // Use RPC function to bypass RLS
            const { data, error } = await supabase.rpc('confirm_order_payment', {
                p_order_id: cleanOrderId
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
                onRetry: () => handleConfirmPayment(orderId, amount)
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

    // Polling
    useEffect(() => {
        fetchOrders(); // Initial fetch
        const interval = setInterval(fetchOrders, 10000);
        return () => clearInterval(interval);
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
            deviceId = 'kds_' + crypto.randomUUID();
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
        updateOrderStatus,
        handleFireItems,
        handleReadyItems,
        handleUndoLastAction,
        handleConfirmPayment,
        handleCancelOrder,
        handleSendSms
    };
};
