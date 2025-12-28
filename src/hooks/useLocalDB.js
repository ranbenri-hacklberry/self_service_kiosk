/**
 * React Hooks for Dexie.js Local Database
 * Uses dexie-react-hooks for live queries that auto-update UI
 * 
 * @module hooks/useLocalDB
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';

/**
 * Hook to get all active orders from local DB
 * Auto-updates when data changes
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by order status
 * @param {boolean} options.unpaidOnly - Only show unpaid orders
 */
export const useOrders = (options = {}) => {
    const { status, unpaidOnly = false } = options;

    return useLiveQuery(async () => {
        let collection = db.orders.orderBy('created_at').reverse();

        if (status) {
            collection = db.orders.where('order_status').equals(status);
        }

        let orders = await collection.toArray();

        if (unpaidOnly) {
            orders = orders.filter(o => !o.is_paid);
        }

        return orders;
    }, [status, unpaidOnly], []);
};

/**
 * Hook to get order items for a specific order
 * @param {string} orderId - The order ID
 */
export const useOrderItems = (orderId) => {
    return useLiveQuery(
        async () => {
            if (!orderId) return [];
            return db.order_items.where('order_id').equals(orderId).toArray();
        },
        [orderId],
        []
    );
};

/**
 * Hook to get all menu items
 * @param {string} category - Optional category filter
 */
export const useMenuItems = (category = null) => {
    return useLiveQuery(
        async () => {
            if (category) {
                return db.menu_items.where('category').equals(category).toArray();
            }
            return db.menu_items.toArray();
        },
        [category],
        []
    );
};

/**
 * Hook to get active KDS orders (pending, in_progress, ready)
 * This is the main hook for KDS display
 */
export const useKDSOrders = () => {
    return useLiveQuery(async () => {
        const activeStatuses = ['pending', 'in_progress', 'ready', 'new'];

        // Get today's active orders
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const orders = await db.orders
            .where('created_at')
            .aboveOrEqual(today.toISOString())
            .toArray();

        // Filter by status and sort
        return orders
            .filter(o => activeStatuses.includes(o.order_status))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }, [], []);
};

/**
 * Hook to get a single customer by phone
 * @param {string} phone - Customer phone number
 */
export const useCustomerByPhone = (phone) => {
    return useLiveQuery(
        async () => {
            if (!phone) return null;
            return db.customers.where('phone_number').equals(phone).first();
        },
        [phone],
        null
    );
};

/**
 * Hook to get all employees for a business
 * @param {string} businessId - Business ID
 */
export const useEmployees = (businessId) => {
    return useLiveQuery(
        async () => {
            if (!businessId) return [];
            return db.employees.where('business_id').equals(businessId).toArray();
        },
        [businessId],
        []
    );
};

/**
 * Hook to get active discounts
 * @param {string} businessId - Business ID
 */
export const useDiscounts = (businessId) => {
    return useLiveQuery(
        async () => {
            if (!businessId) return [];
            return db.discounts
                .where('business_id')
                .equals(businessId)
                .filter(d => d.is_active)
                .toArray();
        },
        [businessId],
        []
    );
};

/**
 * Hook to get sync status
 */
export const useSyncStatus = () => {
    return useLiveQuery(
        async () => {
            const meta = await db.sync_meta.toArray();
            return meta.reduce((acc, item) => {
                acc[item.table_name] = {
                    lastSynced: item.last_synced_at,
                    recordCount: item.record_count
                };
                return acc;
            }, {});
        },
        [],
        {}
    );
};

/**
 * Hook to check if local database has data
 */
export const useHasLocalData = () => {
    return useLiveQuery(
        async () => {
            const ordersCount = await db.orders.count();
            const menuCount = await db.menu_items.count();
            return ordersCount > 0 || menuCount > 0;
        },
        [],
        false
    );
};

/**
 * Hook for order with its items (joined)
 * @param {string} orderId - Order ID
 */
export const useOrderWithItems = (orderId) => {
    return useLiveQuery(
        async () => {
            if (!orderId) return null;

            const order = await db.orders.get(orderId);
            if (!order) return null;

            const items = await db.order_items
                .where('order_id')
                .equals(orderId)
                .toArray();

            // Enrich items with menu item details
            const enrichedItems = await Promise.all(
                items.map(async (item) => {
                    const menuItem = await db.menu_items.get(item.menu_item_id);
                    return {
                        ...item,
                        menu_item: menuItem || { name: 'Unknown', price: 0 }
                    };
                })
            );

            return {
                ...order,
                items: enrichedItems
            };
        },
        [orderId],
        null
    );
};

export default {
    useOrders,
    useOrderItems,
    useMenuItems,
    useKDSOrders,
    useCustomerByPhone,
    useEmployees,
    useDiscounts,
    useSyncStatus,
    useHasLocalData,
    useOrderWithItems
};
