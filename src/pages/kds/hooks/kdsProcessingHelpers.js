const MAX_ACTIVE_ORDER_AGE_MS = 3 * 60 * 60 * 1000; // 3 hours

/**
 * Check if an order is stale (too old to be in active state).
 * Orders older than MAX_ACTIVE_ORDER_AGE_MS should be treated as completed.
 * @param {object} order - Order object
 * @returns {boolean} - True if order is stale
 */
export const isStaleActiveOrder = (order) => {
    if (!order.created_at) return false;

    const activeStatuses = ['new', 'pending', 'in_progress', 'ready', 'held'];
    if (!activeStatuses.includes(order.order_status)) return false;

    const orderAge = Date.now() - new Date(order.created_at).getTime();
    return orderAge > MAX_ACTIVE_ORDER_AGE_MS;
};

/**
 * Filter out stale orders from an array.
 * Use this before processing orders for display.
 * @param {array} orders - Array of orders
 * @returns {array} - Filtered orders (non-stale only)
 */
export const filterStaleOrders = (orders) => {
    const validOrders = [];
    const staleOrders = [];

    for (const order of orders) {
        if (isStaleActiveOrder(order)) {
            staleOrders.push(order);
        } else {
            validOrders.push(order);
        }
    }

    if (staleOrders.length > 0) {
        console.warn(`⚠️ [KDS] Filtered out ${staleOrders.length} stale orders:`,
            staleOrders.map(o => ({ id: o.id, status: o.order_status, created: o.created_at }))
        );
    }

    return validOrders;
};

/**
 * 🌸 KDS Processing Helpers - Pure, Testable Functions
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Extracted from useKDSData for better maintainability and testing.
 * All functions are PURE (no side effects, no external dependencies).
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ DATA FLOW OVERVIEW                                                          │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   Raw Order (from Supabase/Dexie)                                           │
 * │         │                                                                   │
 * │         ▼                                                                   │
 * │   processOrderItems() ──► Filter & Map items                                │
 * │         │                                                                   │
 * │         ▼                                                                   │
 * │   groupItemsByStatus() ──► Split into: new, active, ready, delayed          │
 * │         │                                                                   │
 * │         ▼                                                                   │
 * │   determineCardStatus() ──► Assign cardType & cardStatus per group          │
 * │         │                                                                   │
 * │         ▼                                                                   │
 * │   Multiple KDS Cards (one per status group)                                 │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ STATUS LIFECYCLE                                                            │
 * ├─────────────────────────────────────────────────────────────────────────────┤
 * │                                                                             │
 * │   Order Flow:   pending → new → in_progress → ready → completed             │
 * │                                                                             │
 * │   Item Flow:    pending → new → in_progress → ready → completed             │
 * │                      └──→ held (Second Course) ──┘                          │
 * │                                                                             │
 * │   Card Groups:                                                              │
 * │     - 'new'     : Items with status 'new' or 'pending'                      │
 * │     - 'active'  : Items with status 'in_progress'                           │
 * │     - 'ready'   : Items with status 'ready' or 'completed'                  │
 * │     - 'delayed' : Items with status 'held' (Second Course)                  │
 * │                                                                             │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * @module kdsProcessingHelpers
 * @author Maya's Architecture (Refactored for Production)
 */


/**
 * Robust string helper: Handles strings or objects with translation keys.
 * Pure function - no side effects.
 * @param {string|object|null} val - Value to extract string from
 * @returns {string} - Extracted string or empty string
 */
export const extractString = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
        return val.he || val.name || val.text || val.value_name || val.valueName || val.en || JSON.stringify(val);
    }
    return String(val);
};

/**
 * Parse modifiers from various formats (string, array, object).
 * Handles edge cases like null, undefined, or malformed JSON.
 * @param {string|array|object} mods - Raw modifiers data
 * @returns {array} - Array of modifier strings
 */
export const parseModifiers = (mods) => {
    if (!mods) return [];

    try {
        const parsed = typeof mods === 'string' ? JSON.parse(mods) : mods;
        if (Array.isArray(parsed)) {
            return parsed
                .map(m => extractString(m))
                .filter(Boolean)
                // 🛡️ HIDE INTERNAL FLAGS: Filter out __KDS_OVERRIDE__ from display
                .filter(m => !m.includes('__KDS_OVERRIDE__') && !m.includes('KDS_OVERRIDE'));
        }
        return [];
    } catch (e) {
        // If JSON parse fails, try to extract as-is
        if (typeof mods === 'string' && mods.length > 0) {
            // Also filter here just in case
            if (mods.includes('__KDS_OVERRIDE__')) return [];
            return [mods];
        }
        return [];
    }
};


/**
 * Apply color coding to modifiers based on Hebrew keywords.
 * @param {string} modName - Modifier name
 * @returns {string} - CSS class for color
 */
export const getModifierColor = (modName) => {
    if (!modName) return 'mod-color-gray';

    if (modName.includes('סויה')) return 'mod-color-lightgreen';
    if (modName.includes('שיבולת')) return 'mod-color-beige';
    if (modName.includes('שקדים')) return 'mod-color-lightyellow';
    if (modName.includes('נטול')) return 'mod-color-blue';
    if (modName.includes('רותח')) return 'mod-color-red';
    if (modName.includes('קצף') && !modName.includes('בלי')) return 'mod-color-foam-up';
    if (modName.includes('בלי קצף')) return 'mod-color-foam-none';

    return 'mod-color-gray';
};

/**
 * Build structured modifiers array for React component rendering.
 * @param {array} modsArray - Raw modifiers array
 * @param {string|null} notes - Item notes
 * @returns {array} - Structured modifiers with text and color
 */
export const buildStructuredModifiers = (modsArray, notes = null) => {
    const result = modsArray.map(mod => {
        if (typeof mod === 'object' && mod.is_note) {
            return { text: mod.name, color: 'mod-color-purple', isNote: true };
        }
        const modName = extractString(mod);
        return { text: modName, color: getModifierColor(modName), isNote: false };
    });

    if (notes) {
        result.push({ text: notes, color: 'mod-color-purple', isNote: true });
    }

    return result;
};

/**
 * Check if item should be included based on KDS routing logic.
 * @param {object} item - Order item
 * @param {object} fallbackMenuItem - Fresh menu item data from local cache
 * @returns {boolean} - True if item should be displayed in KDS
 */
export const shouldIncludeItem = (item, fallbackMenuItem = null) => {
    if (item.item_status === 'cancelled') return false;
    return true;
};

/**
 * Filter and map items for a specific order.
 * Handles data inconsistencies, nuclear bypass for offline, and KDS routing logic.
 * @param {object} order - Order object with order_items
 * @param {Map} menuMap - Map of menu item ID to menu item data
 * @returns {array} - Processed items ready for display
 */
export const processOrderItems = (order, menuMap) => {
    // 🛡️ STALE ORDER PROTECTION: Skip orders that are too old to be "active"
    if (isStaleActiveOrder(order)) {
        console.warn(`⚠️ [KDS] Skipping stale order ${order.id} (status: ${order.order_status}, age: ${Math.round((Date.now() - new Date(order.created_at).getTime()) / 3600000)}h)`);
        return []; // Return empty - don't display this order
    }

    const isLocalInProgress = (order._useLocalStatus || order.pending_sync) && order.order_status === 'in_progress';

    return (order.order_items || [])
        .filter(item => {
            if (item.item_status === 'cancelled') return false;

            // Nuclear Bypass: Keep everything if locally in progress (offline/undo scenario)
            if (isLocalInProgress) return true;

            // 🔍 LOOKUP FRESH ITEM DATA
            const freshMenuItem = menuMap?.get(item.menu_item_id);
            return shouldIncludeItem(item, freshMenuItem);
        })
        .map(item => {
            // Visual Status Normalization
            const visualStatus = (isLocalInProgress && ['completed', 'ready'].includes(item.item_status))
                ? 'in_progress' : item.item_status;

            // Modifier Processing
            const modsArray = parseModifiers(item.mods);
            const structuredModifiers = buildStructuredModifiers(modsArray, item.notes);

            // 🔑 CRITICAL: Generate modsKey for proper item grouping
            // This key ensures items with different modifiers are NOT merged together
            // e.g., coffee with oat milk vs regular coffee should remain separate
            const modsKey = modsArray.map(m => typeof m === 'object' ? (m.name || m.text || JSON.stringify(m)) : String(m)).sort().join('|');

            // Fallback to menu cache if menu_items missing from RPC
            const menuItem = menuMap?.get(item.menu_item_id);

            return {
                id: item.id,
                menuItemId: item.menu_items?.id || item.menu_item_id || item.id,
                name: extractString(item.name || item.menu_items?.name || menuItem?.name || 'פריט מהתפריט'),
                modifiers: structuredModifiers,
                modsKey, // 🔑 Key for groupOrderItems to distinguish items by modifiers
                quantity: item.quantity,
                status: visualStatus,
                item_status: item.item_status,
                price: item.menu_items?.price || item.price || menuItem?.price || 0,
                category: item.menu_items?.category || menuItem?.category || '',
                course_stage: item.course_stage || 1,
                item_fired_at: item.item_fired_at,
                is_early_delivered: item.is_early_delivered || (['ready', 'completed'].includes(item.item_status) && !['ready', 'completed'].includes(order.order_status))
            };
        });
};

/**
 * Group items by their display status for split course logic.
 * Groups: 'new', 'active' (in_progress), 'ready', 'delayed' (held)
 * @param {array} items - Processed items
 * @returns {object} - Items grouped by status
 */
export const groupItemsByStatus = (items) => {
    return items.reduce((acc, item) => {
        let groupKey;

        // CRITICAL: Use the normalized 'status' field (which might be overridden by anti-flicker)
        // instead of the raw 'item_status' from the server.
        if (item.status === 'held') {
            groupKey = 'delayed';
        } else if (item.status === 'new' || item.status === 'pending') {
            groupKey = 'new';
        } else if (item.status === 'ready' || item.status === 'completed') {
            groupKey = 'ready';
        } else {
            // covers: in_progress, prep_started, etc.
            groupKey = 'active';
        }

        if (!acc[groupKey]) acc[groupKey] = [];
        acc[groupKey].push(item);
        return acc;
    }, {});
};

/**
 * Determine card type and status based on a group of items and parent order state.
 * @param {string} groupKey - 'new', 'active', 'ready', or 'delayed'
 * @param {array} groupItems - Items in this group
 * @param {object} order - Parent order
 * @returns {object} - { cardType, cardStatus }
 */
export const determineCardStatus = (groupKey, groupItems, order) => {
    let cardType, cardStatus;

    // Handle each group type explicitly
    if (groupKey === 'new') {
        cardType = 'active';
        cardStatus = 'new';
    } else if (groupKey === 'delayed') {
        cardType = 'delayed';
        cardStatus = 'pending';
    } else if (groupKey === 'ready') {
        // Ready group: items that are ready/completed
        cardType = 'ready';
        cardStatus = 'ready';
    } else {
        // Active group: items that are in_progress
        cardType = 'active';
        cardStatus = 'in_progress';
    }

    return { cardType, cardStatus };
};

/**
 * Build base order data structure from raw order.
 * @param {object} order - Raw order from database
 * @returns {object} - Normalized order data
 */
export const buildBaseOrder = (order) => {
    const itemsForTotal = (order.order_items || []).filter(i => i.item_status !== 'cancelled');
    const calculatedTotal = itemsForTotal.reduce((sum, i) => sum + (i.price || i.menu_items?.price || 0) * (i.quantity || 1), 0);
    const totalOrderAmount = order.total_amount || calculatedTotal;
    const paidAmount = order.paid_amount || 0;
    const unpaidAmount = totalOrderAmount - paidAmount;

    // 🕒 DATE PROTECTION: Ensure we have a valid created_at date
    const createdAtDate = (order.created_at && !isNaN(new Date(order.created_at).getTime()))
        ? new Date(order.created_at)
        : new Date(); // Fallback to current time if missing/invalid

    // 🔢 ORDER NUMBER: Use order_number if exists, otherwise friendlier local label
    const isLocal = !order.order_number || String(order.id).length > 20;
    const orderNum = order.order_number || (order.id ? `${String(order.id).slice(0, 4)}` : '???');

    return {
        id: order.id,
        orderNumber: orderNum,
        isLocal,
        customerName: order.customer_name || 'אורח',
        customerPhone: order.customer_phone,
        customerId: order.customer_id,
        isPaid: order.is_paid,
        totalAmount: unpaidAmount > 0 ? unpaidAmount : totalOrderAmount,
        paidAmount: paidAmount,
        fullTotalAmount: totalOrderAmount,
        timestamp: createdAtDate.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
        created_at: createdAtDate.toISOString(), // 👈 ADDED FOR AGING LOGIC
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
};

/**
 * Check if an order has any active items that need attention.
 * @param {array} items - Order items
 * @returns {boolean} - True if order has active items
 */
export const hasActiveItems = (items) => {
    const activeStatuses = ['in_progress', 'prep_started', 'new', 'pending', 'ready', 'held'];
    return items.some(item => activeStatuses.includes(item.item_status));
};

/**
 * Smart ID helper: Ensures ID is the correct type for Dexie.
 * (Numeric for Supabase, String for Local)
 * @param {string|number} id - Raw ID
 * @returns {string|number} - Normalized ID
 */
export const getSmartId = (id) => {
    if (!id) return id;
    if (typeof id === 'number') return id;
    const idStr = String(id).replace(/-stage-\d+/, '').replace('-ready', '').replace('-delayed', '').replace('-new', '');

    // Don't parse UUIDs as integers
    if (idStr.length > 20 && idStr.includes('-')) return idStr;

    if (idStr.startsWith('L')) return idStr; // Local ID
    const parsed = parseInt(idStr, 10);
    return isNaN(parsed) ? idStr : parsed;
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 KDS vs KANBAN VIEW SEPARATION
// ═══════════════════════════════════════════════════════════════════════════════
// 
// KDS (Kitchen Display System): Shows ALL statuses including internal kitchen states
//   - held (Second Course) - internal kitchen logic
//   - in_progress, ready, new, pending, completed
//   - Full control for kitchen staff
//
// KANBAN (Remote Orders Dashboard): Shows SIMPLIFIED statuses for managers/delivery
//   - pending → "ממתינה לאישור"
//   - new/in_progress → "בהכנה"
//   - ready → "מוכנה לאיסוף"
//   - shipped → "נשלחה"
//   - completed → "הושלמה"
//   - Does NOT show 'held' cards (internal kitchen logic)
//

/**
 * Check if an order is relevant for Kanban display.
 * Kanban shows delivery/takeaway orders, not dine-in.
 * @param {object} order - Order object
 * @returns {boolean} - True if order should appear in Kanban
 */
export const isKanbanRelevant = (order) => {
    const orderType = order.order_type || 'dine_in';
    // Kanban is for remote orders (delivery, takeaway)
    // Dine-in orders are managed via KDS
    return orderType === 'delivery' || orderType === 'takeaway';
};

/**
 * Filter item groups for Kanban view.
 * Removes 'delayed' (held) cards which are internal kitchen logic.
 * @param {object} itemsByGroup - Groups from groupItemsByStatus
 * @param {boolean} isKanbanView - True if this is Kanban view
 * @returns {object} - Filtered groups
 */
export const filterGroupsForView = (itemsByGroup, isKanbanView) => {
    if (!isKanbanView) {
        // KDS: Show everything including delayed/held
        return itemsByGroup;
    }

    // KANBAN: Remove 'delayed' group (held items are internal kitchen logic)
    const { delayed, ...kanbanGroups } = itemsByGroup;
    return kanbanGroups;
};

/**
 * Map internal status to user-friendly Kanban status.
 * @param {string} internalStatus - Internal status (in_progress, ready, etc)
 * @param {string} orderType - Order type (delivery, takeaway, dine_in)
 * @returns {object} - { status, displayText, color }
 */
export const mapStatusForView = (internalStatus, orderType = 'dine_in') => {
    const isDelivery = orderType === 'delivery';

    const statusMap = {
        'pending': {
            status: 'pending',
            displayText: 'ממתינה לאישור',
            color: 'yellow'
        },
        'new': {
            status: 'preparing',
            displayText: 'בהכנה',
            color: 'blue'
        },
        'prep_started': {
            status: 'preparing',
            displayText: 'בתהליך הכנה',
            color: 'blue'
        },
        'in_progress': {
            status: 'preparing',
            displayText: 'בהכנה',
            color: 'blue'
        },
        'ready': {
            status: 'ready',
            displayText: isDelivery ? 'מוכנה למשלוח' : 'מוכנה לאיסוף',
            color: 'green'
        },
        'shipped': {
            status: 'shipped',
            displayText: 'נשלחה',
            color: 'purple'
        },
        'completed': {
            status: 'completed',
            displayText: 'הושלמה',
            color: 'gray'
        },
        // 'held' should not appear in Kanban but handle gracefully
        'held': {
            status: 'preparing',
            displayText: 'בהכנה',
            color: 'blue'
        }
    };

    return statusMap[internalStatus] || statusMap['in_progress'];
};

/**
 * Get the appropriate grouping function based on view type.
 * @param {boolean} isKanbanView - True for Kanban, false for KDS
 * @returns {function} - Grouping function
 */
export const getGroupingForView = (isKanbanView) => {
    if (isKanbanView) {
        // Kanban: Simpler grouping without 'delayed'
        return (items) => {
            return items.reduce((acc, item) => {
                let groupKey;

                // Kanban simplification: held items show as 'active'
                if (item.item_status === 'pending') {
                    groupKey = 'pending';
                } else if (item.item_status === 'ready' || item.item_status === 'completed') {
                    groupKey = 'ready';
                } else {
                    groupKey = 'active'; // new, in_progress, held
                }

                if (!acc[groupKey]) acc[groupKey] = [];
                acc[groupKey].push(item);
                return acc;
            }, {});
        };
    }

    // KDS: Full grouping with all statuses
    return groupItemsByStatus;
};
